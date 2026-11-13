ALTER TABLE products
  ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX products_featured_public_index
  ON products (created_at DESC, id DESC)
  WHERE is_active = true AND is_featured = true;
