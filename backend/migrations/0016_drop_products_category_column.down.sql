ALTER TABLE products ADD COLUMN category VARCHAR(50);

UPDATE products p
SET category = (SELECT c.slug FROM categories c WHERE c.id = p.category_id);

ALTER TABLE products ALTER COLUMN category SET NOT NULL;
ALTER TABLE products ADD CONSTRAINT products_category_check
    CHECK (category IN ('perfume', 'cosmetics', 'shoes'));
