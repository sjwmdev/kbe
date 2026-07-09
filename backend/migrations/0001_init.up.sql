CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price       DECIMAL(10, 2) NOT NULL,
    category    VARCHAR(50) NOT NULL CHECK (category IN ('perfume', 'cosmetics', 'shoes')),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE product_images (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    image_url  VARCHAR(1024) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE product_likes (
    product_id  UUID PRIMARY KEY REFERENCES products (id) ON DELETE CASCADE,
    likes_count INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_products_is_active ON products (is_active);
CREATE INDEX idx_product_images_product_id ON product_images (product_id);
