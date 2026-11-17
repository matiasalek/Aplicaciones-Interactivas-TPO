WITH examples(previous_name, current_name, previous_url, current_url) AS (
  VALUES
    ('AMD Ryzen 5 7600', 'AMD Ryzen 5 7600', 'https://placehold.co/800x600?text=AMD%20Ryzen%205%207600', '/api/v1/media/products/ryzen-5-7600.webp'),
    ('AMD Ryzen 7 7800X3D', 'AMD Ryzen 7 7800X3D', 'https://placehold.co/800x600?text=AMD%20Ryzen%207%207800X3D', '/api/v1/media/products/ryzen-7-7800x3d.webp'),
    ('Intel Core i5-14600K', 'Intel Core i5-14600K', 'https://placehold.co/800x600?text=Intel%20Core%20i5-14600K', '/api/v1/media/products/intel-i5-14600k.webp'),
    ('Intel Core i7-14700K', 'Intel Core i7-14700K', 'https://placehold.co/800x600?text=Intel%20Core%20i7-14700K', '/api/v1/media/products/intel-i7-14700k.webp'),
    ('NVIDIA GeForce RTX 4060 8GB', 'NVIDIA GeForce RTX 4060 8GB', 'https://placehold.co/800x600?text=NVIDIA%20GeForce%20RTX%204060%208GB', '/api/v1/media/products/rtx-4060.webp'),
    ('NVIDIA GeForce RTX 4070 SUPER', 'NVIDIA GeForce RTX 4070 SUPER', 'https://placehold.co/800x600?text=NVIDIA%20GeForce%20RTX%204070%20SUPER', '/api/v1/media/products/rtx-4070-super.webp'),
    ('AMD Radeon RX 7800 XT', 'AMD Radeon RX 7900 XT', 'https://placehold.co/800x600?text=AMD%20Radeon%20RX%207800%20XT', '/api/v1/media/products/rx-7900-xt.webp'),
    ('AMD Radeon RX 7900 XTX', 'AMD Radeon RX 7900 XTX', 'https://placehold.co/800x600?text=AMD%20Radeon%20RX%207900%20XTX', '/api/v1/media/products/radeon-rx-7900-xtx.webp'),
    ('ASUS TUF Gaming B650-PLUS', 'ASUS TUF B450-PLUS GAMING', 'https://placehold.co/800x600?text=ASUS%20TUF%20Gaming%20B650-PLUS', '/api/v1/media/products/asus-tuf-b450-plus.webp'),
    ('MSI MAG Z790 Tomahawk WiFi', 'ASUS ROG Strix Z690-A Gaming WiFi', 'https://placehold.co/800x600?text=MSI%20MAG%20Z790%20Tomahawk%20WiFi', '/api/v1/media/products/asus-rog-strix-z690-a.webp'),
    ('Gigabyte B550 AORUS Elite', 'MSI MAG B550 Tomahawk', 'https://placehold.co/800x600?text=Gigabyte%20B550%20AORUS%20Elite', '/api/v1/media/products/msi-mag-b550-tomahawk.webp'),
    ('Corsair Vengeance DDR5 32GB', 'Corsair Vengeance RGB DDR5 32GB 6000 CL36', 'https://placehold.co/800x600?text=Corsair%20Vengeance%20DDR5%2032GB', '/api/v1/media/products/corsair-vengeance-rgb-ddr5.webp'),
    ('Kingston Fury Beast DDR5 32GB', 'HyperX Fury DDR4 32GB 3200 CL16', 'https://placehold.co/800x600?text=Kingston%20Fury%20Beast%20DDR5%2032GB', '/api/v1/media/products/hyperx-fury-ddr4.webp'),
    ('G.Skill Ripjaws V DDR4 32GB', 'Corsair Vengeance LPX DDR4 16GB 2666', 'https://placehold.co/800x600?text=G.Skill%20Ripjaws%20V%20DDR4%2032GB', '/api/v1/media/products/corsair-ddr4-16gb.webp'),
    ('Samsung 990 PRO NVMe 1TB', 'Samsung 990 PRO NVMe 4TB', 'https://placehold.co/800x600?text=Samsung%20990%20PRO%20NVMe%201TB', '/api/v1/media/products/samsung-990-pro-4tb.webp'),
    ('WD Black SN850X NVMe 2TB', 'WD Black SN850X NVMe 8TB', 'https://placehold.co/800x600?text=WD%20Black%20SN850X%20NVMe%202TB', '/api/v1/media/products/wd-black-sn850x-8tb.webp'),
    ('Crucial P3 Plus NVMe 1TB', 'Crucial P3 Plus NVMe 2TB', 'https://placehold.co/800x600?text=Crucial%20P3%20Plus%20NVMe%201TB', '/api/v1/media/products/crucial-p3-plus-2tb.webp'),
    ('Corsair RM750e 750W', 'Corsair CX600M 600W', 'https://placehold.co/800x600?text=Corsair%20RM750e%20750W', '/api/v1/media/products/corsair-cx600m.webp'),
    ('Seasonic Focus GX-850', 'SilverStone DA850R Gold 850W', 'https://placehold.co/800x600?text=Seasonic%20Focus%20GX-850', '/api/v1/media/products/silverstone-da850r.webp'),
    ('Cooler Master MWE Gold 650W', 'Corsair CX500 500W', 'https://placehold.co/800x600?text=Cooler%20Master%20MWE%20Gold%20650W', '/api/v1/media/products/corsair-cx500.webp')
), updated_products AS (
  UPDATE products AS product
  SET name = examples.current_name,
      description = CASE
        WHEN examples.current_name = examples.previous_name THEN product.description
        ELSE examples.current_name || ', componente para armar una PC para videojuegos.'
      END,
      image_url = examples.current_url
  FROM examples
  WHERE product.name = examples.previous_name
    AND product.image_url = examples.previous_url
    AND EXISTS (
      SELECT 1 FROM product_images AS image
      WHERE image.product_id = product.id AND image.position = 0
        AND image.url = examples.previous_url
    )
    AND NOT EXISTS (
      SELECT 1 FROM product_images AS image
      WHERE image.product_id = product.id AND image.position > 0
    )
    AND (
      examples.current_name = examples.previous_name
      OR (
        product.description = examples.previous_name || ', componente para armar una PC para videojuegos.'
        AND NOT EXISTS (
          SELECT 1 FROM announcements WHERE product_id = product.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM products AS other
          WHERE lower(other.name) = lower(examples.current_name)
        )
      )
    )
  RETURNING product.id, product.image_url
)
UPDATE product_images AS image
SET url = updated_products.image_url
FROM updated_products
WHERE image.product_id = updated_products.id AND image.position = 0;
