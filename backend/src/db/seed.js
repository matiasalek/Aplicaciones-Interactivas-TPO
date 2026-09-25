const database = require("./database");

const categories = [
  ["Procesadores", "Procesadores para computadoras de videojuegos y productividad"],
  ["Tarjetas gráficas", "Tarjetas gráficas dedicadas para videojuegos de alto rendimiento"],
  ["Placas madre", "Placas madre para plataformas AMD e Intel"],
  ["Memoria RAM", "Kits de memoria RAM DDR4 y DDR5 para computadoras de escritorio"],
  ["Almacenamiento", "Unidades SSD NVMe y almacenamiento de alta capacidad"],
  ["Fuentes de alimentación", "Fuentes de alimentación modulares y no modulares confiables"],
];

const products = [
  ["AMD Ryzen 5 7600", "Procesadores", 289999, "in_stock"],
  ["AMD Ryzen 7 7800X3D", "Procesadores", 649999, "in_stock"],
  ["Intel Core i5-14600K", "Procesadores", 479999, "in_stock"],
  ["Intel Core i7-14700K", "Procesadores", 699999, "preorder"],
  ["NVIDIA GeForce RTX 4060 8GB", "Tarjetas gráficas", 589999, "in_stock"],
  ["NVIDIA GeForce RTX 4070 SUPER", "Tarjetas gráficas", 1099999, "in_stock"],
  ["AMD Radeon RX 7800 XT", "Tarjetas gráficas", 949999, "in_stock"],
  ["AMD Radeon RX 7900 XTX", "Tarjetas gráficas", 1699999, "preorder"],
  ["ASUS TUF Gaming B650-PLUS", "Placas madre", 389999, "in_stock"],
  ["MSI MAG Z790 Tomahawk WiFi", "Placas madre", 519999, "in_stock"],
  ["Gigabyte B550 AORUS Elite", "Placas madre", 249999, "out_of_stock"],
  ["Corsair Vengeance DDR5 32GB", "Memoria RAM", 189999, "in_stock"],
  ["Kingston Fury Beast DDR5 32GB", "Memoria RAM", 174999, "in_stock"],
  ["G.Skill Ripjaws V DDR4 32GB", "Memoria RAM", 129999, "in_stock"],
  ["Samsung 990 PRO NVMe 1TB", "Almacenamiento", 199999, "in_stock"],
  ["WD Black SN850X NVMe 2TB", "Almacenamiento", 289999, "in_stock"],
  ["Crucial P3 Plus NVMe 1TB", "Almacenamiento", 129999, "out_of_stock"],
  ["Corsair RM750e 750W", "Fuentes de alimentación", 169999, "in_stock"],
  ["Seasonic Focus GX-850", "Fuentes de alimentación", 229999, "in_stock"],
  ["Cooler Master MWE Gold 650W", "Fuentes de alimentación", 139999, "preorder"],
];

function imageUrlFor(name) {
  return `https://placehold.co/800x600?text=${encodeURIComponent(name)}`;
}

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

    for (const [name, categoryName, price, availability] of products) {
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
          VALUES ($1, $2, $3, $4, $5, $6, true)
          ON CONFLICT (lower(name)) DO UPDATE
          SET description = EXCLUDED.description
        `,
        [
          categoryId,
          name,
          `${name}, componente para armar una PC para videojuegos.`,
          imageUrlFor(name),
          price,
          availability,
        ],
      );
    }
  });

  console.log(`Seed complete: ${categories.length} categories and ${products.length} products.`);
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
