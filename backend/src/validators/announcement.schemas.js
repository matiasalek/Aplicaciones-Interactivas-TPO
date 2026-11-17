const { z } = require("zod");
const {
  entityIdSchema,
  entityIdTextSchema,
  moneySchema,
} = require("./common.schemas");

const announcementIdSchema = z.object({ id: entityIdTextSchema });

const announcementSchema = z
  .object({
    type: z.enum(["news", "promotion"]),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(2000),
    isPublished: z.boolean().default(false),
    productId: entityIdSchema.nullable().default(null),
    promotionPrice: moneySchema.nullable().default(null),
  })
  .strict()
  .superRefine(({ type, productId, promotionPrice }, context) => {
    if (productId === null && promotionPrice === null) return;
    if (type === "news" || productId === null || promotionPrice === null) {
      context.addIssue({
        code: "custom",
        path: [productId === null ? "productId" : "promotionPrice"],
        message:
          "only promotions can include a product and a promotional price",
      });
    }
  });

module.exports = { announcementIdSchema, announcementSchema };
