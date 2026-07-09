DROP INDEX IF EXISTS idx_users_business_id;
DROP INDEX IF EXISTS idx_products_business_id;
DROP INDEX IF EXISTS idx_customers_business_id;
DROP INDEX IF EXISTS idx_orders_business_id;
DROP INDEX IF EXISTS idx_media_folders_business_id;
DROP INDEX IF EXISTS idx_media_assets_business_id;
DROP INDEX IF EXISTS idx_slider_posters_business_id;
DROP INDEX IF EXISTS idx_audit_logs_business_id;
DROP INDEX IF EXISTS idx_roles_business_id;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_business_id_phone_key;
ALTER TABLE customers ADD CONSTRAINT customers_phone_key UNIQUE (phone);

ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_business_id_name_key;
ALTER TABLE roles ADD CONSTRAINT roles_name_key UNIQUE (name);

ALTER TABLE roles ALTER COLUMN business_id DROP NOT NULL;
ALTER TABLE slider_posters ALTER COLUMN business_id DROP NOT NULL;
ALTER TABLE media_assets ALTER COLUMN business_id DROP NOT NULL;
ALTER TABLE media_folders ALTER COLUMN business_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN business_id DROP NOT NULL;
ALTER TABLE customers ALTER COLUMN business_id DROP NOT NULL;
ALTER TABLE products ALTER COLUMN business_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN business_id DROP NOT NULL;
