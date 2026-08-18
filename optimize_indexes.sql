-- Foreign key indexes (prioritas tertinggi — buat JOIN antar tabel)
CREATE INDEX idx_ws_orders_user_id ON ws_orders(user_id);
CREATE INDEX idx_ws_transactions_order_id ON ws_transactions(order_id);
CREATE INDEX idx_ws_user_activity_user_id ON ws_user_activity(user_id);

-- Index untuk filter/sort umum
CREATE INDEX idx_ws_orders_order_date ON ws_orders(order_date);
CREATE INDEX idx_ws_orders_status ON ws_orders(order_status);
CREATE INDEX idx_ws_transactions_date ON ws_transactions(transaction_date);
CREATE INDEX idx_ws_transactions_status ON ws_transactions(status);
CREATE INDEX idx_ws_user_activity_timestamp ON ws_user_activity(activity_timestamp);

-- Index tambahan di ws_user (buat lookup login/profil)
CREATE INDEX idx_ws_user_email ON ws_user(user_email);
CREATE INDEX idx_ws_user_status ON ws_user(status);

-- Composite index buat query gabungan (misal: "riwayat order user tertentu, urut tanggal")
CREATE INDEX idx_ws_orders_user_date ON ws_orders(user_id, order_date);
CREATE INDEX idx_ws_transactions_order_date ON ws_transactions(order_id, transaction_date);

-- Update statistik planner setelah bikin index baru
ANALYZE ws_user;
ANALYZE ws_orders;
ANALYZE ws_transactions;
ANALYZE ws_user_activity;
