CREATE TABLE media_folders (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE media_assets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id         UUID REFERENCES media_folders(id) ON DELETE SET NULL,
    image_url         VARCHAR(1024) NOT NULL,
    original_filename VARCHAR(255) NOT NULL DEFAULT '',
    size_bytes        BIGINT NOT NULL DEFAULT 0,
    width             INT NOT NULL DEFAULT 0,
    height            INT NOT NULL DEFAULT 0,
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE product_images ADD COLUMN media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE slider_posters ADD COLUMN media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL;

CREATE INDEX idx_media_assets_folder_id ON media_assets (folder_id);
CREATE INDEX idx_product_images_media_asset_id ON product_images (media_asset_id);
CREATE INDEX idx_slider_posters_media_asset_id ON slider_posters (media_asset_id);

-- Backfill: give every image ever uploaded a library entry, so the Media
-- Library isn't empty on first launch and existing images become reusable.
INSERT INTO media_assets (image_url, created_at)
SELECT DISTINCT image_url, now() FROM product_images
UNION
SELECT DISTINCT image_url, now() FROM slider_posters;

UPDATE product_images pi SET media_asset_id = ma.id
FROM media_assets ma WHERE ma.image_url = pi.image_url;

UPDATE slider_posters sp SET media_asset_id = ma.id
FROM media_assets ma WHERE ma.image_url = sp.image_url;
