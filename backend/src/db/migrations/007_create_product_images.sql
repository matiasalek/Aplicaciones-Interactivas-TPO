CREATE TABLE product_images (
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 9),
  url text NOT NULL CHECK (btrim(url) <> '' AND char_length(url) <= 2000),
  PRIMARY KEY (product_id, position)
);

-- Preservar la imagen principal de todas las publicaciones existentes.
INSERT INTO product_images (product_id, position, url)
SELECT id, 0, image_url FROM products;
