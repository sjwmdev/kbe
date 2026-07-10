ALTER TABLE products ADD COLUMN colors TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_products_colors ON products USING GIN (colors);
