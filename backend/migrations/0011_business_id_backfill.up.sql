-- Nullable-first retrofit: add business_id to every business-owned table,
-- backfill existing rows to Kalour (the only tenant today), then a later
-- migration (0012) tightens these to NOT NULL once every row has a value.

ALTER TABLE users ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE products ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE customers ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE orders ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE media_folders ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE media_assets ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE slider_posters ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE audit_logs ADD COLUMN business_id UUID REFERENCES businesses(id);
ALTER TABLE roles ADD COLUMN business_id UUID REFERENCES businesses(id);

UPDATE users SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
UPDATE products SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
UPDATE customers SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
UPDATE orders SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
UPDATE media_folders SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
UPDATE media_assets SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
UPDATE slider_posters SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
UPDATE audit_logs SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
UPDATE roles SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
