ALTER TABLE products ADD COLUMN category_id UUID REFERENCES categories(id);

UPDATE products p
SET category_id = (
    SELECT c.id FROM categories c
    WHERE c.business_id = p.business_id AND c.slug = p.category
);

-- Any product whose old category string didn't match a seeded category
-- (shouldn't happen for Kalour — perfume/cosmetics/shoes were seeded 1:1 in
-- migration 0010 — but defends against a mismatch) falls back to that
-- business's first category rather than leaving a NULL.
UPDATE products p
SET category_id = (
    SELECT c.id FROM categories c
    WHERE c.business_id = p.business_id
    ORDER BY c.display_order, c.name
    LIMIT 1
)
WHERE category_id IS NULL;

ALTER TABLE products ALTER COLUMN category_id SET NOT NULL;

-- The inline REFERENCES above has no ON DELETE clause, which defaults to
-- RESTRICT/NO ACTION: a product without a category is a broken UI state, so
-- deleting an in-use category is blocked, never silently null/cascade.

CREATE INDEX idx_products_category_id ON products (category_id);

-- The old string column is superseded by category_id above and no Go code
-- writes it anymore; relaxed here (rather than dropped outright) so it can
-- still be read for reference until migration 0016 drops it for good, once
-- every call site is confirmed cut over.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE products ALTER COLUMN category DROP NOT NULL;
