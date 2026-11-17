CREATE TABLE announcements (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type varchar(20) NOT NULL CHECK (type IN ('news', 'promotion')),
  title varchar(120) NOT NULL CHECK (btrim(title) <> ''),
  description varchar(2000) NOT NULL CHECK (btrim(description) <> ''),
  is_published boolean NOT NULL DEFAULT false,
  product_id integer REFERENCES products(id) ON DELETE CASCADE,
  promotion_price numeric(12, 2) CHECK (promotion_price >= 0),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT announcements_promotion_fields_check CHECK (
    (product_id IS NULL AND promotion_price IS NULL)
    OR (type = 'promotion' AND product_id IS NOT NULL AND promotion_price IS NOT NULL)
  )
);

CREATE INDEX announcements_product_index ON announcements (product_id)
  WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX announcements_one_published_offer_per_product
  ON announcements (product_id)
  WHERE is_published AND product_id IS NOT NULL;

CREATE TRIGGER announcements_set_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
