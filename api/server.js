const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  host: process.env.PGHOST || 'postgres',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres123',
  database: process.env.PGDATABASE || 'challenge_db',
  max: 20,
  idleTimeoutMillis: 30000,
});

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

// ROUND 5: GET /api/health
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true, status: 'running' });
});

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

// ROUND 3: GET /api/metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const [dup, missing, totalR] = await Promise.all([
      pool.query(`SELECT COUNT(*)::bigint AS cnt FROM (
        SELECT user_email FROM ws_user WHERE user_email IS NOT NULL AND user_email != ''
        GROUP BY user_email HAVING COUNT(*) > 1
      ) d`),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE user_email IS NULL OR user_email = '') AS missing_email,
        COUNT(*) FILTER (WHERE msisdn IS NULL OR msisdn = '') AS missing_phone
        FROM ws_user`),
      pool.query(`SELECT COUNT(*)::bigint AS total FROM ws_user`),
    ]);

    const duplicates = parseInt(dup.rows[0].cnt, 10);
    const missingFields = parseInt(missing.rows[0].missing_email, 10) + parseInt(missing.rows[0].missing_phone, 10);
    const total = parseInt(totalR.rows[0].total, 10);
    const qualityScore = Math.max(0, Math.round((1 - (duplicates + missingFields) / (total * 2)) * 1000) / 10);

    res.status(200).json({ duplicates, missing_fields: missingFields, quality_score: qualityScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ROUND 4: POST /api/duplicates
app.post('/api/duplicates', async (req, res) => {
  try {
    const method = (req.body && req.body.method) || 'email';
    let query;
    if (method === 'ip_address') {
      query = `
        WITH last_ip AS (
          SELECT DISTINCT ON (user_id) user_id, ip_address
          FROM ws_user_activity WHERE ip_address IS NOT NULL
          ORDER BY user_id, activity_timestamp DESC
        )
        SELECT a.user_id AS id1, b.user_id AS id2, 0.95::numeric AS similarity
        FROM last_ip a JOIN last_ip b ON a.ip_address = b.ip_address AND a.user_id < b.user_id
        LIMIT 1000`;
    } else if (method === 'phone') {
      query = `
        SELECT a.user_id AS id1, b.user_id AS id2, 0.9::numeric AS similarity
        FROM ws_user a JOIN ws_user b ON a.msisdn = b.msisdn AND a.user_id < b.user_id
        WHERE a.msisdn IS NOT NULL AND a.msisdn != '' LIMIT 1000`;
    } else {
      query = `
        SELECT a.user_id AS id1, b.user_id AS id2, 1.0::numeric AS similarity
        FROM ws_user a JOIN ws_user b ON a.user_email = b.user_email AND a.user_id < b.user_id
        WHERE a.user_email IS NOT NULL AND a.user_email != '' LIMIT 1000`;
    }
    const result = await pool.query(query);
    res.status(200).json({ duplicates: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.listen(3000, () => console.log('API running on port 3000'));
