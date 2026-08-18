const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { Pool } = require('pg');
const swaggerSpec = require('./swagger');

const app = express();
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

const pool = new Pool({
  host: process.env.PGHOST || 'postgres',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres123',
  database: process.env.PGDATABASE || 'challenge_db',
  max: 20,
  idleTimeoutMillis: 30000,
});

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check + jumlah total record
 *     description: Mengecek koneksi database dan mengembalikan total record pada tabel ws_user.
 *     responses:
 *       200:
 *         description: Service dan database dalam kondisi sehat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ready }
 *                 total_records: { type: integer, example: 14999896 }
 *                 database: { type: string, example: connected }
 *                 timestamp: { type: string, format: date-time }
 *       500:
 *         description: Database tidak terhubung
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: error }
 *                 database: { type: string, example: disconnected }
 *                 error: { type: string }
 */
// ROUND 1: GET /health
app.get('/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT COUNT(*)::bigint AS total FROM ws_user');
    res.status(200).json({
      status: 'ready',
      total_records: parseInt(r.rows[0].total, 10),
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Simple health check (load test)
 *     description: Health check ringan tanpa query database, dipakai untuk load testing.
 *     responses:
 *       200:
 *         description: Service berjalan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 status: { type: string, example: running }
 */
// ROUND 5: GET /api/health
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true, status: 'running' });
});

/**
 * @openapi
 * /api/search:
 *   get:
 *     tags: [Search]
 *     summary: Cari user berdasarkan nama, email, telepon, atau lokasi
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Kata kunci pencarian (dicocokkan dengan ILIKE %q%)
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [name, email, phone, location], default: name }
 *         description: Kolom yang dicari
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *         description: Jumlah maksimum hasil (di-cap ke 100)
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *         description: Offset pagination
 *     responses:
 *       200:
 *         description: Hasil pencarian
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query: { type: string }
 *                 type: { type: string }
 *                 results:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/SearchResultItem' }
 *                 total: { type: integer, example: 42 }
 *                 took_ms: { type: integer, example: 87 }
 *       500:
 *         description: Terjadi error pada server
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
// ROUND 2: GET /api/search
app.get('/api/search', async (req, res) => {
  const start = Date.now();
  try {
    const q = (req.query.q || '').toString();
    const type = (req.query.type || 'name').toString();
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const param = `%${q}%`;

    let whereClause;
    switch (type) {
      case 'email': whereClause = 'user_email ILIKE $1'; break;
      case 'phone': whereClause = 'msisdn ILIKE $1'; break;
      case 'location': whereClause = 'location ILIKE $1'; break;
      default: whereClause = '(user_name ILIKE $1 OR full_name ILIKE $1)'; break;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::bigint AS total FROM ws_user WHERE ${whereClause}`, [param]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const dataResult = await pool.query(`
      WITH matched AS (
        SELECT user_id, user_name, full_name, user_email, msisdn
        FROM ws_user
        WHERE ${whereClause}
        ORDER BY user_id
        LIMIT $2 OFFSET $3
      )
      SELECT m.*,
        COALESCE(o.order_count, 0)::int AS order_count,
        COALESCE(o.total_spent, 0)::numeric AS total_spent
      FROM matched m
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS order_count, SUM(order_amount) AS total_spent
        FROM ws_orders
        WHERE user_id IN (SELECT user_id FROM matched)
        GROUP BY user_id
      ) o ON o.user_id = m.user_id
    `, [param, limit, offset]);

    res.status(200).json({
      query: q, type, results: dataResult.rows, total, took_ms: Date.now() - start,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/metrics:
 *   get:
 *     tags: [Metrics]
 *     summary: Metrik kualitas data
 *     description: Menghitung jumlah email duplikat, field yang hilang (email/telepon), dan skor kualitas data keseluruhan.
 *     responses:
 *       200:
 *         description: Metrik kualitas data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 duplicates: { type: integer, example: 1509793 }
 *                 missing_fields: { type: integer, example: 720000 }
 *                 quality_score: { type: number, example: 97.6 }
 *       500:
 *         description: Terjadi error pada server
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
// ROUND 3: GET /api/metrics
// `duplicates` = jumlah user unik yang emailnya ATAU nomor teleponnya duplikat.
// Dihitung via inclusion-exclusion (|email dup| + |phone dup| - |keduanya dup|) supaya
// tidak perlu JOIN balik + UNION/DISTINCT di atas 15 juta baris - lihat DATABASE_NOTES.md.
app.get('/api/metrics', async (req, res) => {
  try {
    const [dupEmail, dupPhone, dupBoth, missing, totalR] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(cnt), 0)::bigint AS rows FROM (
        SELECT COUNT(*) AS cnt FROM ws_user WHERE user_email IS NOT NULL AND user_email != ''
        GROUP BY user_email HAVING COUNT(*) > 1
      ) d`),
      pool.query(`SELECT COALESCE(SUM(cnt), 0)::bigint AS rows FROM (
        SELECT COUNT(*) AS cnt FROM ws_user WHERE msisdn IS NOT NULL AND msisdn != ''
        GROUP BY msisdn HAVING COUNT(*) > 1
      ) d`),
      pool.query(`WITH dup_emails AS (
        SELECT user_email FROM ws_user WHERE user_email IS NOT NULL AND user_email != ''
        GROUP BY user_email HAVING COUNT(*) > 1
      ), dup_phones AS (
        SELECT msisdn FROM ws_user WHERE msisdn IS NOT NULL AND msisdn != ''
        GROUP BY msisdn HAVING COUNT(*) > 1
      )
      SELECT COUNT(*)::bigint AS rows FROM ws_user u
      WHERE EXISTS (SELECT 1 FROM dup_emails de WHERE de.user_email = u.user_email)
        AND EXISTS (SELECT 1 FROM dup_phones dp WHERE dp.msisdn = u.msisdn)`),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE user_email IS NULL OR user_email = '') AS missing_email,
        COUNT(*) FILTER (WHERE msisdn IS NULL OR msisdn = '') AS missing_phone
        FROM ws_user`),
      pool.query(`SELECT COUNT(*)::bigint AS total FROM ws_user`),
    ]);

    const duplicates = parseInt(dupEmail.rows[0].rows, 10) + parseInt(dupPhone.rows[0].rows, 10) - parseInt(dupBoth.rows[0].rows, 10);
    const missingFields = parseInt(missing.rows[0].missing_email, 10) + parseInt(missing.rows[0].missing_phone, 10);
    const total = parseInt(totalR.rows[0].total, 10);
    const qualityScore = Math.max(0, Math.round((1 - (duplicates + missingFields) / (total * 2)) * 1000) / 10);

    res.status(200).json({ duplicates, missing_fields: missingFields, quality_score: qualityScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/duplicates:
 *   post:
 *     tags: [Duplicates]
 *     summary: Deteksi user duplikat
 *     description: Mencari pasangan user yang kemungkinan duplikat berdasarkan email, telepon, atau IP address terakhir yang digunakan.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               method:
 *                 type: string
 *                 enum: [email, phone, ip_address]
 *                 default: email
 *                 description: Metode deteksi duplikat
 *           examples:
 *             email:
 *               value: { method: email }
 *             phone:
 *               value: { method: phone }
 *             ip_address:
 *               value: { method: ip_address }
 *     responses:
 *       200:
 *         description: Daftar pasangan user duplikat (maksimum 1000 pasangan)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 duplicates:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/DuplicatePair' }
 *                 count: { type: integer, example: 250 }
 *       500:
 *         description: Terjadi error pada server
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
// ROUND 4: POST /api/duplicates
app.post('/api/duplicates', async (req, res) => {
  try {
    const method = (req.body && req.body.method) || 'email';
    let query;
    // Narrow down to groups that actually repeat (GROUP BY ... HAVING COUNT(*) > 1) before
    // self-joining — joining the raw 15M-row table against itself on a non-unique column
    // produces a near-full-table merge/nested-loop join and takes 30-60+ seconds.
    if (method === 'ip_address') {
      query = `
        WITH last_ip AS (
          SELECT DISTINCT ON (user_id) user_id, ip_address
          FROM ws_user_activity WHERE ip_address IS NOT NULL
          ORDER BY user_id, activity_timestamp DESC
        ),
        dup_ips AS (
          SELECT ip_address FROM last_ip GROUP BY ip_address HAVING COUNT(*) > 1 LIMIT 500
        ),
        dup_rows AS (
          SELECT l.user_id, l.ip_address, u.full_name, u.user_name
          FROM last_ip l
          JOIN dup_ips d ON d.ip_address = l.ip_address
          JOIN ws_user u ON u.user_id = l.user_id
        )
        SELECT a.user_id AS id1, COALESCE(a.full_name, a.user_name) AS name1,
               b.user_id AS id2, COALESCE(b.full_name, b.user_name) AS name2,
               0.95::numeric AS similarity
        FROM dup_rows a JOIN dup_rows b ON a.ip_address = b.ip_address AND a.user_id < b.user_id
        LIMIT 1000`;
    } else if (method === 'phone') {
      query = `
        WITH dup_phones AS (
          SELECT msisdn FROM ws_user WHERE msisdn IS NOT NULL AND msisdn != ''
          GROUP BY msisdn HAVING COUNT(*) > 1 LIMIT 500
        ),
        dup_rows AS (
          SELECT u.user_id, u.msisdn, u.full_name, u.user_name FROM ws_user u JOIN dup_phones d ON d.msisdn = u.msisdn
        )
        SELECT a.user_id AS id1, COALESCE(a.full_name, a.user_name) AS name1,
               b.user_id AS id2, COALESCE(b.full_name, b.user_name) AS name2,
               0.9::numeric AS similarity
        FROM dup_rows a JOIN dup_rows b ON a.msisdn = b.msisdn AND a.user_id < b.user_id
        LIMIT 1000`;
    } else {
      query = `
        WITH dup_emails AS (
          SELECT user_email FROM ws_user WHERE user_email IS NOT NULL AND user_email != ''
          GROUP BY user_email HAVING COUNT(*) > 1 LIMIT 500
        ),
        dup_rows AS (
          SELECT u.user_id, u.user_email, u.full_name, u.user_name FROM ws_user u JOIN dup_emails d ON d.user_email = u.user_email
        )
        SELECT a.user_id AS id1, COALESCE(a.full_name, a.user_name) AS name1,
               b.user_id AS id2, COALESCE(b.full_name, b.user_name) AS name2,
               1.0::numeric AS similarity
        FROM dup_rows a JOIN dup_rows b ON a.user_email = b.user_email AND a.user_id < b.user_id
        LIMIT 1000`;
    }
    const result = await pool.query(query);
    res.status(200).json({ duplicates: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/user-profile/{user_id}:
 *   get:
 *     tags: [Profile]
 *     summary: Profil user gabungan (JOIN orders/transactions/activity)
 *     description: Mengambil profil user beserta agregat jumlah order, transaksi, dan aktivitas (4-table JOIN).
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema: { type: integer }
 *         description: ID user
 *     responses:
 *       200:
 *         description: Profil user ditemukan
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UserProfile' }
 *       400:
 *         description: user_id tidak valid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: User tidak ditemukan
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       500:
 *         description: Terjadi error pada server
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
// Round 5 extra: GET /api/user-profile/:user_id (4-table JOIN)
app.get('/api/user-profile/:user_id', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id, 10);
    if (isNaN(userId)) return res.status(400).json({ error: 'invalid user_id' });

    const result = await pool.query(`
      SELECT u.user_id, u.user_name, u.full_name, u.user_email, u.msisdn, u.status,
        COALESCE(o.order_count, 0)::int AS order_count,
        COALESCE(o.total_spent, 0)::numeric AS total_spent,
        COALESCE(t.transaction_count, 0)::int AS transaction_count,
        COALESCE(t.total_transaction_amount, 0)::numeric AS total_transaction_amount,
        COALESCE(a.activity_count, 0)::int AS activity_count
      FROM ws_user u
      LEFT JOIN (SELECT user_id, COUNT(*) order_count, SUM(order_amount) total_spent
                 FROM ws_orders WHERE user_id = $1 GROUP BY user_id) o ON o.user_id = u.user_id
      LEFT JOIN (SELECT ord.user_id, COUNT(tr.*) transaction_count, SUM(tr.transaction_amount) total_transaction_amount
                 FROM ws_orders ord JOIN ws_transactions tr ON tr.order_id = ord.order_id
                 WHERE ord.user_id = $1 GROUP BY ord.user_id) t ON t.user_id = u.user_id
      LEFT JOIN (SELECT user_id, COUNT(*) activity_count
                 FROM ws_user_activity WHERE user_id = $1 GROUP BY user_id) a ON a.user_id = u.user_id
      WHERE u.user_id = $1
    `, [userId]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'user not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
