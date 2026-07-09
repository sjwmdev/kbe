CREATE TABLE categories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id, slug)
);

CREATE INDEX idx_categories_business_id ON categories (business_id);

INSERT INTO categories (business_id, name, slug, display_order)
SELECT id, 'Manukato', 'perfume', 1 FROM businesses WHERE slug = 'kalour'
UNION ALL
SELECT id, 'Vipodozi', 'cosmetics', 2 FROM businesses WHERE slug = 'kalour'
UNION ALL
SELECT id, 'Viatu', 'shoes', 3 FROM businesses WHERE slug = 'kalour';
