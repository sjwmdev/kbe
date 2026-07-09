ALTER TABLE static_pages DROP CONSTRAINT static_pages_pkey;
ALTER TABLE static_pages ADD PRIMARY KEY (slug);
ALTER TABLE static_pages DROP COLUMN business_id;

ALTER TABLE site_settings DROP COLUMN brand_accent_color_dark;
ALTER TABLE site_settings DROP COLUMN brand_accent_color;
ALTER TABLE site_settings DROP COLUMN logo_dark_url;
ALTER TABLE site_settings DROP COLUMN logo_light_url;
ALTER TABLE site_settings DROP COLUMN company_name;

ALTER TABLE site_settings DROP CONSTRAINT site_settings_pkey;
ALTER TABLE site_settings ADD COLUMN id BOOLEAN NOT NULL DEFAULT true CHECK (id = true);
ALTER TABLE site_settings ADD PRIMARY KEY (id);
ALTER TABLE site_settings DROP COLUMN business_id;
