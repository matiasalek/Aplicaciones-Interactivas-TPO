const { z } = require("zod");
const { phoneSchema, webUrlSchema } = require("./common.schemas");

const socialLinksSchema = z.record(z.string(), webUrlSchema).default({});

const storeSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().min(1).max(5000),
    address: z.string().trim().min(1).max(300),
    phone: phoneSchema,
    socialLinks: socialLinksSchema,
    openingHours: z.string().trim().min(1).max(1000),
  })
  .strict();

module.exports = { storeSchema };
