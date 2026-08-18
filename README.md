# Customer Intelligence Platform

Platform analisis data pelanggan skala 15M+ record, dibangun untuk 17 Agustus Coding Challenge.

## Tech Stack
- **Database**: PostgreSQL 14 (Docker)
- **Backend**: Node.js + Express (`api/`, port 4000 internal)
- **Frontend**: Next.js (`web/`, port 3000) — proxies `/health` dan `/api/*` ke backend lewat rewrites, jadi endpoint yang sama tetap diakses dari port 3000

## Setup & Menjalankan

```bash
git clone https://github.com/rezimonarchintiteknologi/17-AGUSTUS-CHALLENGE.git
cd 17-AGUSTUS-CHALLENGE
docker-compose up -d --build
sleep 30
curl http://localhost:3000/health
```

Dashboard tersedia di `http://localhost:3000/`

## API Documentation (Swagger)

Dokumentasi interaktif tersedia di `http://localhost:4000/api-docs` (Swagger UI), dengan spec mentah di `http://localhost:4000/api-docs.json`.

## API Endpoints

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/health` | GET | Health check + total records |
| `/api/health` | GET | Simple health check (load test) |
| `/api/search?q=&type=&limit=&offset=` | GET | Search users (type: name/email/phone/location) |
| `/api/metrics` | GET | Data quality metrics |
| `/api/duplicates` | POST | Duplicate detection (body: `{"method":"email\|phone\|ip_address"}`) |
| `/api/user-profile/:user_id` | GET | Profil user + JOIN orders/transactions/activity |

## Struktur Project
cat > ~/challenge-project/DATABASE_NOTES.md << 'ENDOFFILE'
# Database Notes

## Dataset
- 4 tabel utama: `ws_user` (14,999,896), `ws_orders` (2,999,986), `ws_transactions` (2,400,548), `ws_user_activity` (2,000,000)
- Total ~22.4 juta baris
- Dump asli: PostgreSQL 14, tanpa index sama sekali kecuali primary key

## Masalah yang Ditemukan
- Semua foreign key (`ws_orders.user_id`, `ws_transactions.order_id`, `ws_user_activity.user_id`) tidak memiliki index — menyebabkan full table scan pada setiap JOIN
- Kolom filter umum (`order_date`, `order_status`, `transaction_date`, `status`, `activity_timestamp`) juga tanpa index
- ~2% user punya email duplikat, ~5% punya nomor telepon duplikat
- ~8% missing email, ~40% missing nomor telepon

## Index yang Ditambahkan
```sql
CREATE INDEX idx_ws_orders_user_id ON ws_orders(user_id);
CREATE INDEX idx_ws_transactions_order_id ON ws_transactions(order_id);
CREATE INDEX idx_ws_user_activity_user_id ON ws_user_activity(user_id);
CREATE INDEX idx_ws_orders_order_date ON ws_orders(order_date);
CREATE INDEX idx_ws_orders_status ON ws_orders(order_status);
CREATE INDEX idx_ws_transactions_date ON ws_transactions(transaction_date);
CREATE INDEX idx_ws_transactions_status ON ws_transactions(status);
CREATE INDEX idx_ws_user_activity_timestamp ON ws_user_activity(activity_timestamp);
CREATE INDEX idx_ws_user_email ON ws_user(user_email);
CREATE INDEX idx_ws_user_status ON ws_user(status);
CREATE INDEX idx_ws_orders_user_date ON ws_orders(user_id, order_date);
CREATE INDEX idx_ws_transactions_order_date ON ws_transactions(order_id, transaction_date);
```
Lihat file `optimize_indexes.sql` untuk skrip lengkap.

## Strategi per Endpoint
- **`/api/search`**: filter dulu di `ws_user` (pakai index nama/email/phone), baru JOIN agregat order hanya untuk baris yang sudah di-limit — menghindari agregasi penuh 3 juta baris tiap request
- **`/api/metrics`**: hitung duplikat via `GROUP BY user_email HAVING COUNT(*) > 1`, memakai index-only scan pada `idx_ws_user_email`
- **`/api/duplicates`**: self-join pada kolom yang di-index (`user_email`/`msisdn`) atau `ip_address` (dari `ws_user_activity`, ambil aktivitas terakhir tiap user dulu)
- **`/api/user-profile/:user_id`**: 3 subquery terpisah per tabel, masing-masing difilter `user_id = $1` memakai index FK — didesain untuk load test 100 concurrent request

## Catatan
- Semua kalkulasi dijalankan live (tidak ada pre-computed cache), sesuai aturan challenge
- Query pakai parameterized queries (`$1`, `$2`, dst) untuk mencegah SQL injection, mengingat dataset ini sengaja berisi string mencurigakan di kolom `location`
