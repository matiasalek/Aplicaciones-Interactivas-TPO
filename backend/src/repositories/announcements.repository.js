const { AppError } = require("../errors/app-error");

const ANNOUNCEMENT_COLUMNS = `
  announcements.id,
  announcements.type,
  announcements.title,
  announcements.description,
  announcements.is_published AS "isPublished",
  announcements.promotion_price::float8 AS "promotionPrice",
  announcements.created_at AS "createdAt",
  CASE WHEN products.id IS NOT NULL THEN json_build_object(
    'id', products.id,
    'name', products.name,
    'price', products.price
  ) END AS product
`;

const ANNOUNCEMENTS_FROM = `
  FROM announcements
  LEFT JOIN products ON products.id = announcements.product_id
`;

function createAnnouncementsRepository(database) {
  async function findById(id, executor = database) {
    const result = await executor.query(
      `SELECT ${ANNOUNCEMENT_COLUMNS}
       ${ANNOUNCEMENTS_FROM}
       WHERE announcements.id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  async function save(values, id) {
    try {
      return await database.withTransaction(async (client) => {
        if (values.productId !== null) {
          // Coordina la publicación con las ediciones del precio habitual.
          const result = await client.query(
            "SELECT price::float8 AS price FROM products WHERE id = $1 FOR UPDATE",
            [values.productId],
          );
          const product = result.rows[0];
          if (!product)
            throw new AppError(
              400,
              "INVALID_PROMOTION_PRODUCT",
              "Product not found",
            );
          if (values.promotionPrice >= product.price)
            throw new AppError(
              400,
              "INVALID_PROMOTION_PRICE",
              "The promotional price must be lower than the regular price",
            );
        }

        const parameters = [
          values.type,
          values.title,
          values.description,
          values.isPublished,
          values.productId,
          values.promotionPrice,
        ];
        const result =
          id === undefined
            ? await client.query(
                `INSERT INTO announcements
                (type, title, description, is_published, product_id, promotion_price)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
                parameters,
              )
            : await client.query(
                `UPDATE announcements SET
                 type = $1, title = $2, description = $3, is_published = $4,
                 product_id = $5, promotion_price = $6
               WHERE id = $7 RETURNING id`,
                [...parameters, id],
              );
        return result.rowCount ? findById(result.rows[0].id, client) : null;
      });
    } catch (error) {
      if (error.constraint === "announcements_one_published_offer_per_product")
        throw new AppError(
          409,
          "PRODUCT_PROMOTION_CONFLICT",
          "The product already has a published promotion",
        );
      throw error;
    }
  }

  return {
    async findAll({ publicOnly }) {
      const result = await database.query(
        `SELECT ${ANNOUNCEMENT_COLUMNS}
         ${ANNOUNCEMENTS_FROM}
         ${
           publicOnly
             ? "WHERE announcements.is_published AND (announcements.product_id IS NULL OR products.is_active)"
             : ""
         }
         ORDER BY announcements.created_at DESC, announcements.id DESC`,
      );
      return result.rows;
    },
    async productOptions() {
      const result = await database.query(
        `SELECT id, name, price::float8 AS price, is_active AS "isActive"
         FROM products ORDER BY name, id`,
      );
      return result.rows;
    },
    findById,
    create: (values) => save(values),
    update: (id, values) => save(values, id),
    async remove(id) {
      const result = await database.query(
        "DELETE FROM announcements WHERE id = $1",
        [id],
      );
      return result.rowCount > 0;
    },
  };
}

module.exports = { createAnnouncementsRepository };
