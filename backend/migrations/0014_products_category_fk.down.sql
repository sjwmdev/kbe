UPDATE products SET category = 'perfume' WHERE category IS NULL;
ALTER TABLE products ALTER COLUMN category SET NOT NULL;
ALTER TABLE products ADD CONSTRAINT products_category_check
    CHECK (category IN ('perfume', 'cosmetics', 'shoes'));

DROP INDEX IF EXISTS idx_products_category_id;
ALTER TABLE products DROP COLUMN IF EXISTS category_id;
