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

Lihat `DATABASE_NOTES.md` untuk detail schema, index, dan strategi query per endpoint.
