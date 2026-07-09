ALTER TABLE users ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE media_folders ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE media_assets ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE slider_posters ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE roles ALTER COLUMN business_id SET NOT NULL;
-- audit_logs.business_id stays nullable — some entries (e.g. a failed login
-- against an email that resolves to no user) have no tenant to attach to.

-- Every business needs its own "SuperAdmin"/"Manager"/"Editor" — the old
-- globally-unique role name no longer makes sense once roles are per-tenant.
ALTER TABLE roles DROP CONSTRAINT roles_name_key;
ALTER TABLE roles ADD CONSTRAINT roles_business_id_name_key UNIQUE (business_id, name);

-- Two different businesses' WhatsApp customers will absolutely share phone
-- numbers by coincidence — uniqueness must be scoped per-business.
ALTER TABLE customers DROP CONSTRAINT customers_phone_key;
ALTER TABLE customers ADD CONSTRAINT customers_business_id_phone_key UNIQUE (business_id, phone);

CREATE INDEX idx_users_business_id ON users (business_id);
CREATE INDEX idx_products_business_id ON products (business_id);
CREATE INDEX idx_customers_business_id ON customers (business_id);
CREATE INDEX idx_orders_business_id ON orders (business_id);
CREATE INDEX idx_media_folders_business_id ON media_folders (business_id);
CREATE INDEX idx_media_assets_business_id ON media_assets (business_id);
CREATE INDEX idx_slider_posters_business_id ON slider_posters (business_id);
CREATE INDEX idx_audit_logs_business_id ON audit_logs (business_id);
CREATE INDEX idx_roles_business_id ON roles (business_id);
