const database = require("./database");
const { catalogImageBase } = require("../product-images");
const products = require("./seed-products");

const categories = [
  [
    "Procesadores",
    "Procesadores para computadoras de videojuegos y productividad",
  ],
  [
    "Tarjetas gráficas",
    "Tarjetas gráficas dedicadas para videojuegos de alto rendimiento",
  ],
  ["Placas madre", "Placas madre para plataformas AMD e Intel"],
  [
    "Memoria RAM",
    "Kits de memoria RAM DDR4 y DDR5 para computadoras de escritorio",
  ],
  ["Almacenamiento", "Unidades SSD NVMe y almacenamiento de alta capacidad"],
  [
    "Fuentes de alimentación",
    "Fuentes de alimentación modulares y no modulares confiables",
  ],
];

async function seed() {
  await database.withTransaction(async (client) => {
    for (const [name, description] of categories) {
      await client.query(
        `
          INSERT INTO categories (name, description)
          VALUES ($1, $2)
          ON CONFLICT (lower(name)) DO UPDATE
          SET description = EXCLUDED.description
        `,
        [name, description],
      );
    }

    const categoryResult = await client.query(
      "SELECT id, name FROM categories",
    );
    const categoryIds = new Map(
      categoryResult.rows.map((category) => [category.name, category.id]),
    );

    for (const [
      previousName,
      name,
      categoryName,
      price,
      availability,
      image,
    ] of products) {
      const categoryId = categoryIds.get(categoryName);

      if (!categoryId) {
        throw new Error(`Seed category not found: ${categoryName}`);
      }

      await client.query(
        `
          INSERT INTO products (
            category_id,
            name,
            description,
            image_url,
            price,
            availability,
            is_active
          )
          SELECT $1, $2, $3, $4, $5, $6, true
          WHERE $7::text IS NULL OR NOT EXISTS (
            SELECT 1 FROM products WHERE lower(name) = lower($7)
          )
          ON CONFLICT (lower(name)) DO NOTHING
        `,
        [
          categoryId,
          name,
          `${name}, componente para armar una PC para videojuegos.`,
          `${catalogImageBase}/${image}.webp`,
          price,
          availability,
          previousName,
        ],
      );
    }
    await client.query(`
      INSERT INTO product_images (product_id, position, url)
      SELECT p.id, 0, p.image_url FROM products p
      WHERE NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id)
      ON CONFLICT (product_id, position) DO NOTHING
    `);
  });

  console.log(
    `Seed complete: ${categories.length} categories and ${products.length} products.`,
  );
}

if (require.main === module) {
  seed()
    .catch((error) => {
      console.error("Database seed failed.", error);
      process.exitCode = 1;
    })
    .finally(() => database.close());
}

module.exports = { seed };
