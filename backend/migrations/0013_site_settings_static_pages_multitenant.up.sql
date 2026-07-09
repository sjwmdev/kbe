-- site_settings converts from a global singleton (id BOOLEAN, always true)
-- to one row per business, keyed by business_id. Branding fields are added
-- here too, reusing this table rather than a second parallel settings table.
ALTER TABLE site_settings ADD COLUMN business_id UUID REFERENCES businesses(id);
UPDATE site_settings SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
ALTER TABLE site_settings ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE site_settings DROP CONSTRAINT site_settings_pkey;
ALTER TABLE site_settings DROP COLUMN id;
ALTER TABLE site_settings ADD PRIMARY KEY (business_id);

ALTER TABLE site_settings ADD COLUMN company_name VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN logo_light_url VARCHAR(1024) NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN logo_dark_url VARCHAR(1024) NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN brand_accent_color VARCHAR(20) NOT NULL DEFAULT '#b80049';
ALTER TABLE site_settings ADD COLUMN brand_accent_color_dark VARCHAR(20) NOT NULL DEFAULT '#8f003d';

UPDATE site_settings SET company_name = 'Kalour Beauty Empire'
WHERE business_id = (SELECT id FROM businesses WHERE slug = 'kalour');

-- static_pages: PK moves from a bare slug (global) to (business_id, slug) —
-- every business gets its own About/Contact/Privacy/Terms copy.
ALTER TABLE static_pages ADD COLUMN business_id UUID REFERENCES businesses(id);
UPDATE static_pages SET business_id = (SELECT id FROM businesses WHERE slug = 'kalour');
ALTER TABLE static_pages ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE static_pages DROP CONSTRAINT static_pages_pkey;
ALTER TABLE static_pages ADD PRIMARY KEY (business_id, slug);
