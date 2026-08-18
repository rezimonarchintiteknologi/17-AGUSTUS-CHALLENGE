# Database Notes

## Dataset
- 4 tabel utama: `ws_user` (15,000,000), `ws_orders` (2,999,986), `ws_transactions` (2,400,548), `ws_user_activity` (2,000,000)
- Total ~22.4 juta baris
- Dump asli: PostgreSQL 14, tanpa index sama sekali kecuali primary key

## Masalah yang Ditemukan
- Semua foreign key (`ws_orders.user_id`, `ws_transactions.order_id`, `ws_user_activity.user_id`) tidak memiliki index — menyebabkan full table scan pada setiap JOIN
- Kolom filter umum (`order_date`, `order_status`, `transaction_date`, `status`, `activity_timestamp`) juga tanpa index
- ~2% user punya email duplikat, ~5% punya nomor telepon duplikat
- ~40% missing nomor telepon. Kolom `user_email` di dump `_anonymized_v2` ini **tidak ada yang NULL/kosong** (beda dari deskripsi awal soal ~8% missing email) — kemungkinan proses anonymisasi mengisi semua email dengan nilai sintetis.

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
CREATE INDEX idx_ws_user_msisdn ON ws_user(msisdn);
```
Lihat file `optimize_indexes.sql` untuk skrip lengkap. GIN trigram index (`pg_trgm`) untuk pencarian fuzzy ada di `user_email`, `msisdn`, `full_name`, `user_name`, `location`.

## Strategi per Endpoint
- **`/api/search`**: filter dulu di `ws_user` (pakai index nama/email/phone), baru JOIN agregat order hanya untuk baris yang sudah di-limit — menghindari agregasi penuh 3 juta baris tiap request
- **`/api/metrics`**: lihat bagian "Metric `duplicates`" di bawah
- **`/api/duplicates`**: self-join pada kolom yang di-index (`user_email`/`msisdn`) atau `ip_address` (dari `ws_user_activity`, ambil aktivitas terakhir tiap user dulu)
- **`/api/user-profile/:user_id`**: 3 subquery terpisah per tabel, masing-masing difilter `user_id = $1` memakai index FK — didesain untuk load test 100 concurrent request

## Metric `duplicates` (Round 3, `/api/metrics`)

**Definisi:** jumlah user unik di `ws_user` yang emailnya duplikat ATAU nomor teleponnya duplikat (union ter-dedup, bukan sum) — nilai real per data yang ada saat ini: **1.509.793**.

**Cara hitung:** inclusion-exclusion — `|email duplikat| + |phone duplikat| - |email duplikat DAN phone duplikat|` (298.288 + 1.236.314 - 24.809 = 1.509.793). Tiga komponen ini dihitung lewat 3 query yang jalan paralel via `Promise.all`, tanpa perlu JOIN balik + `UNION`/`SORT DISTINCT` di atas hasil gabungan ~1,5 juta baris (versi itu sempat dicoba, hasilnya sama tapi ~66 detik). Pendekatan inclusion-exclusion ini tetap butuh 1 query self-join (`AND` dua `EXISTS` pada CTE grup duplikat) untuk komponen overlap, yang sendirian ~53 detik pada mesin ini; dijalankan bareng 4 query lain (kontensi CPU/IO), total **request `/api/metrics` end-to-end saat ini ~70-80 detik**.

Ini adalah angka yang **akurat** (bukan aproksimasi/sum yang bisa double-count), sesuai permintaan eksplisit untuk pakai real data — tapi konsekuensinya latency jauh di atas wajar untuk endpoint dashboard. Tidak bisa dipercepat lebih jauh tanpa melanggar aturan "no pre-computed / harus live", karena akar masalahnya adalah full-scan + self-join di atas 15 juta baris pada resource VM yang terbatas (bukan masalah index — index yang relevan, `idx_ws_user_email` dan `idx_ws_user_msisdn`, sudah dipakai index-only scan oleh planner).

**Kenapa awalnya hanya hitung grup email duplikat (11.562) dan itu tidak mendekati ekspektasi ~15rb?**
Ditelusuri langsung ke data: dataset ini sengaja diisi seed email berpola `duplicate_<n>@test.com` — ada 13.810 nilai unik dengan pola ini. Dari situ, 2.973 di antaranya sekarang hanya muncul 1 kali (pasangannya hilang), sehingga grup duplikat yang tersisa dari pola ini tinggal 10.837 (+ 725 duplikat organik non-pola = 11.562 total grup). Pasangan yang hilang ini kemungkinan besar korban proses anonymisasi (`_anonymized_v2`) yang mengubah field secara independen per baris, sehingga sebagian pasangan yang sengaja dibuat sama menjadi tidak sama lagi. Ini karakteristik data yang sudah berubah dari dump asli, bukan bug pada query hitung grupnya (sudah diverifikasi manual, angkanya akurat untuk data yang ada).

## Catatan
- Semua kalkulasi dijalankan live (tidak ada pre-computed cache), sesuai aturan challenge
- Query pakai parameterized queries (`$1`, `$2`, dst) untuk mencegah SQL injection, mengingat dataset ini sengaja berisi string mencurigakan di kolom `location`
