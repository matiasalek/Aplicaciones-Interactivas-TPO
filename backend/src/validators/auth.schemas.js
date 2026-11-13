const { z } = require("zod");

const { emailSchema, phoneSchema } = require("./common.schemas");

const passwordSchema = z
  .string({ error: "password must be a string" })
  .min(8, "password must contain at least 8 characters")
  .max(72, "password must contain at most 72 characters")
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, {
    message: "password must contain at most 72 UTF-8 bytes",
  });

const firstNameSchema = z
  .string({ error: "firstName must be a string" })
  .trim()
  .min(1, "firstName is required")
  .max(100, "firstName must contain at most 100 characters");

const lastNameSchema = z
  .string({ error: "lastName must be a string" })
  .trim()
  .min(1, "lastName is required")
  .max(100, "lastName must contain at most 100 characters");

const registerSchema = z
  .object({
    firstName: firstNameSchema,
    lastName: lastNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
  })
  .strict();

const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string({ error: "password must be a string" }).min(1),
  })
  .strict();

const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

const resetPasswordSchema = z
  .object({
    token: z
      .string({ error: "token must be a string" })
      .regex(/^[a-f0-9]{64}$/i, "token is invalid"),
    password: passwordSchema,
  })
  .strict();

const updateProfileSchema = z
  .object({
    firstName: firstNameSchema.optional(),
    lastName: lastNameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  });

module.exports = {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
};
