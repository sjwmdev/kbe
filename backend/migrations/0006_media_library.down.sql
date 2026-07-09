ALTER TABLE slider_posters DROP COLUMN IF EXISTS media_asset_id;
ALTER TABLE product_images DROP COLUMN IF EXISTS media_asset_id;

DROP TABLE IF EXISTS media_assets;
DROP TABLE IF EXISTS media_folders;
