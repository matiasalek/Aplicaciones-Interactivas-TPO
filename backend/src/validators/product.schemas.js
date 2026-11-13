const { z } = require("zod");
const {
  webUrlSchema,
  entityIdSchema,
  entityIdTextSchema,
} = require("./common.schemas");

const productIdSchema = z.object({
  id: entityIdTextSchema,
});

const categoryIdSchema = entityIdSchema;
const availabilitySchema = z.enum(["in_stock", "out_of_stock", "preorder"]);
const imageUrlsSchema = z
  .array(webUrlSchema)
  .min(1)
  .max(10)
  .superRefine((urls, context) => {
    const seen = new Set();
    urls.forEach((url, index) => {
      let key;
      try {
        key = new URL(url).href;
      } catch {
        return;
      }
      if (seen.has(key))
        context.addIssue({
          code: "custom",
          path: [index],
          message: "image URLs must not be repeated",
        });
      seen.add(key);
    });
  });

function exclusiveImages(values, context) {
  if (values.imageUrl !== undefined && values.imageUrls !== undefined)
    context.addIssue({
      code: "custom",
      path: ["imageUrls"],
      message: "send imageUrl or imageUrls, not both",
    });
}

const productFields = {
  categoryId: categoryIdSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  imageUrl: webUrlSchema,
  price: z
    .number()
    .min(0)
    .max(9999999999.99)
    .refine((value) => Math.round(value * 100) / 100 === value, {
      message: "price must contain at most 2 decimal places",
    }),
  availability: availabilitySchema,
  isActive: z.boolean(),
  isFeatured: z.boolean(),
};

const createProductSchema = z
  .object({
    ...productFields,
    imageUrl: webUrlSchema.optional(),
    imageUrls: imageUrlsSchema.optional(),
    availability: availabilitySchema.default("in_stock"),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
  })
  .strict()
  .superRefine((values, context) => {
    exclusiveImages(values, context);
    if (values.imageUrl === undefined && values.imageUrls === undefined)
      context.addIssue({
        code: "custom",
        path: ["imageUrls"],
        message: "at least one image is required",
      });
  });

const updateProductSchema = z
  .object({
    categoryId: productFields.categoryId.optional(),
    name: productFields.name.optional(),
    description: productFields.description.optional(),
    imageUrl: productFields.imageUrl.optional(),
    imageUrls: imageUrlsSchema.optional(),
    price: productFields.price.optional(),
    availability: productFields.availability.optional(),
    isActive: productFields.isActive.optional(),
    isFeatured: productFields.isFeatured.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  })
  .superRefine(exclusiveImages);

const priceFilterSchema = z
  .string()
  .trim()
  .regex(
    /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/,
    "price filter must be a decimal with up to two places",
  )
  .transform(Number)
  .pipe(productFields.price);

const publicProductQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    categoryId: entityIdTextSchema.optional(),
    minPrice: priceFilterSchema.optional(),
    maxPrice: priceFilterSchema.optional(),
    availability: availabilitySchema.optional(),
    isFeatured: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    sort: z
      .enum(["newest", "name", "price_asc", "price_desc"])
      .default("newest"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(12),
  })
  .strict()
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      query.minPrice <= query.maxPrice,
    {
      path: ["maxPrice"],
      message: "maxPrice must be greater than or equal to minPrice",
    },
  );

const adminProductQuerySchema = publicProductQuerySchema.safeExtend({
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

module.exports = {
  adminProductQuerySchema,
  createProductSchema,
  productIdSchema,
  publicProductQuerySchema,
  updateProductSchema,
};
