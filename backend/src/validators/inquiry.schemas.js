const { z } = require("zod");
const {
  emailSchema,
  phoneSchema,
  entityIdTextSchema,
} = require("./common.schemas");

const inquiryIdSchema = z.object({
  id: entityIdTextSchema,
});

const createInquirySchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    email: emailSchema,
    phone: phoneSchema.nullable().optional().default(null),
    subject: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(10000),
  })
  .strict();

const updateInquiryStatusSchema = z
  .object({
    status: z.enum(["pending", "read", "answered"]),
  })
  .strict();

const listInquiriesQuerySchema = z
  .object({
    status: z.enum(["pending", "read", "answered"]).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

module.exports = {
  createInquirySchema,
  inquiryIdSchema,
  listInquiriesQuerySchema,
  updateInquiryStatusSchema,
};
