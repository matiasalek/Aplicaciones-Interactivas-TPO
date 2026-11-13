const { z } = require("zod");

const emailSchema = z
  .string()
  .trim()
  .pipe(z.email("email must be valid").toLowerCase().max(320));

const phoneSchema = z
  .string()
  .trim()
  .min(5)
  .max(50)
  .regex(/^\+?[0-9 ().-]+$/, "phone contains invalid characters")
  .refine((value) => value.replace(/\D/g, "").length >= 5, {
    message: "phone must contain at least 5 digits",
  });

const webUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .pipe(
    z.url({ protocol: /^https?$/, error: "URL must use http:// or https://" }),
  );

// Las claves de las tablas usan integer de PostgreSQL.
const entityIdSchema = z.number().int().positive().max(2147483647);
const entityIdTextSchema = z
  .string()
  .regex(/^\d+$/, "id must contain only digits")
  .transform(Number)
  .pipe(entityIdSchema);

module.exports = {
  emailSchema,
  phoneSchema,
  webUrlSchema,
  entityIdSchema,
  entityIdTextSchema,
};
