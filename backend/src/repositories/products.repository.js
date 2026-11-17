const { AppError } = require("../errors/app-error");
const { imageReferenceKey } = require("../product-images");

const PROMOTION_JOIN = `
  LEFT JOIN announcements AS offer
    ON offer.product_id = products.id AND offer.is_published AND products.is_active
`;
const EFFECTIVE_PRICE = "COALESCE(offer.promotion_price, products.price)";
const featuredExpression = (publicOnly) =>
  publicOnly
    ? "(products.is_featured OR offer.product_id IS NOT NULL)"
    : "products.is_featured";

const PRODUCT_COLUMNS = `
  products.id,
  products.name,
  products.description,
  products.image_url AS "imageUrl",
  COALESCE(
    (SELECT json_agg(images.url ORDER BY images.position)
     FROM product_images AS images WHERE images.product_id = products.id),
    json_build_array(products.image_url)
  ) AS "imageUrls",
  products.price::float8 AS price,
  offer.promotion_price::float8 AS "promotionPrice",
  ${EFFECTIVE_PRICE}::float8 AS "effectivePrice",
  products.availability,
  products.is_active AS "isActive",
  products.created_at AS "createdAt",
  products.updated_at AS "updatedAt",
  json_build_object(
    'id', categories.id,
    'name', categories.name
  ) AS category
`;

const SORT_SQL = {
  newest: "products.created_at DESC, products.id DESC",
  offers_first:
    "offer.updated_at DESC NULLS LAST, products.created_at DESC, products.id DESC",
  name: "products.name ASC, products.id ASC",
  price_asc: `${EFFECTIVE_PRICE} ASC, products.id ASC`,
  price_desc: `${EFFECTIVE_PRICE} DESC, products.id DESC`,
};

async function replaceImages(client, id, urls) {
  await client.query("DELETE FROM product_images WHERE product_id = $1", [id]);
  await client.query(
    `INSERT INTO product_images (product_id, position, url)
     SELECT $1, (ordinality - 1)::smallint, url
     FROM unnest($2::text[]) WITH ORDINALITY AS images(url, ordinality)`,
    [id, urls],
  );
}

function createProductsRepository(database) {
  async function findAll(query, { publicOnly }) {
    const parameters = [];
    const conditions = [];
    const featured = featuredExpression(publicOnly);

    if (publicOnly) {
      conditions.push("products.is_active = true");
    } else if (query.isActive !== undefined) {
      parameters.push(query.isActive);
      conditions.push(`products.is_active = $${parameters.length}`);
    }

    if (query.isFeatured !== undefined) {
      parameters.push(query.isFeatured);
      conditions.push(`${featured} = $${parameters.length}`);
    }

    if (query.q) {
      parameters.push(query.q);
      conditions.push(`
        to_tsvector('simple', products.name || ' ' || products.description)
        @@ websearch_to_tsquery('simple', $${parameters.length})
      `);
    }

    if (query.categoryId) {
      parameters.push(query.categoryId);
      conditions.push(`products.category_id = $${parameters.length}`);
    }

    if (query.availability) {
      parameters.push(query.availability);
      conditions.push(`products.availability = $${parameters.length}`);
    }

    if (query.minPrice !== undefined) {
      parameters.push(query.minPrice);
      conditions.push(`${EFFECTIVE_PRICE} >= $${parameters.length}`);
    }
    if (query.maxPrice !== undefined) {
      parameters.push(query.maxPrice);
      conditions.push(`${EFFECTIVE_PRICE} <= $${parameters.length}`);
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    parameters.push(query.limit, (query.page - 1) * query.limit);
    const result = await database.query(
      `
        SELECT
          ${PRODUCT_COLUMNS},
          ${featured} AS "isFeatured",
          count(*) OVER()::integer AS "totalCount"
        FROM products
        JOIN categories ON categories.id = products.category_id
        ${PROMOTION_JOIN}
        ${where}
        ORDER BY ${SORT_SQL[query.sort]}
        LIMIT $${parameters.length - 1}
        OFFSET $${parameters.length}
      `,
      parameters,
    );

    const total = result.rows[0]?.totalCount || 0;
    const items = result.rows.map(({ totalCount: _totalCount, ...row }) => row);
    return { items, total };
  }

  async function findById(id, { publicOnly }, executor = database) {
    const result = await executor.query(
      `
        SELECT ${PRODUCT_COLUMNS}, ${featuredExpression(publicOnly)} AS "isFeatured"
        FROM products
        JOIN categories ON categories.id = products.category_id
        ${PROMOTION_JOIN}
        WHERE products.id = $1
          ${publicOnly ? "AND products.is_active = true" : ""}
      `,
      [id],
    );
    return result.rows[0] || null;
  }

  return {
    findAll,
    findById,

    async create(values) {
      return database.withTransaction(async (client) => {
        const imageUrls = values.imageUrls ?? [values.imageUrl];
        const result = await client.query(
          `INSERT INTO products (
            category_id, name, description, image_url, price, availability, is_active, is_featured
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [
            values.categoryId,
            values.name,
            values.description,
            imageUrls[0],
            values.price,
            values.availability,
            values.isActive,
            values.isFeatured,
          ],
        );
        const id = result.rows[0].id;
        await replaceImages(client, id, imageUrls);
        return findById(id, { publicOnly: false }, client);
      });
    },

    async update(id, values) {
      return database.withTransaction(async (client) => {
        // Serializar ediciones de la galería y devolver datos del mismo commit.
        const existing = await client.query(
          "SELECT id FROM products WHERE id = $1 FOR UPDATE",
          [id],
        );
        if (!existing.rows[0]) return null;

        if (values.price !== undefined) {
          const offer = await client.query(
            `SELECT 1 FROM announcements
             WHERE product_id = $1 AND is_published AND promotion_price >= $2`,
            [id, values.price],
          );
          if (offer.rowCount)
            throw new AppError(
              409,
              "REGULAR_PRICE_CONFLICT",
              "The regular price must be higher than the published promotional price",
            );
        }

        let imageUrls = values.imageUrls;
        if (values.imageUrl !== undefined) {
          const current = await client.query(
            "SELECT url FROM product_images WHERE product_id = $1 ORDER BY position",
            [id],
          );
          const primaryKey = imageReferenceKey(values.imageUrl);
          imageUrls = [
            values.imageUrl,
            ...current.rows
              .slice(1)
              .map((row) => row.url)
              .filter((url) => imageReferenceKey(url) !== primaryKey),
          ];
        }

        const columnByProperty = {
          categoryId: "category_id",
          name: "name",
          description: "description",
          price: "price",
          availability: "availability",
          isActive: "is_active",
          isFeatured: "is_featured",
        };
        const fields = [];
        const parameters = [];
        for (const [property, column] of Object.entries(columnByProperty)) {
          if (values[property] !== undefined) {
            parameters.push(values[property]);
            fields.push(`${column} = $${parameters.length}`);
          }
        }
        if (imageUrls !== undefined) {
          parameters.push(imageUrls[0]);
          fields.push(`image_url = $${parameters.length}`);
        }
        parameters.push(id);
        await client.query(
          `UPDATE products SET ${fields.join(", ")} WHERE id = $${parameters.length}`,
          parameters,
        );
        if (imageUrls !== undefined) await replaceImages(client, id, imageUrls);
        return findById(id, { publicOnly: false }, client);
      });
    },

    async remove(id) {
      const result = await database.query(
        "DELETE FROM products WHERE id = $1",
        [id],
      );
      return result.rowCount > 0;
    },
  };
}

module.exports = { createProductsRepository };
