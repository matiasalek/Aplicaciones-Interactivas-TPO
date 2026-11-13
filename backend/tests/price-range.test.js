const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  publicProductQuerySchema,
  adminProductQuerySchema,
} = require("../src/validators/product.schemas");

test("rangos de precio públicos y administrativos admiten límites opcionales y cero", () => {
  for (const schema of [publicProductQuerySchema, adminProductQuerySchema]) {
    assert.equal(schema.parse({}).minPrice, undefined);
    assert.equal(schema.parse({}).maxPrice, undefined);
    assert.equal(schema.parse({ minPrice: "0" }).minPrice, 0);
    assert.equal(schema.parse({ maxPrice: "0" }).maxPrice, 0);
    assert.equal(schema.parse({ minPrice: "0", maxPrice: "0" }).maxPrice, 0);
    const query = schema.parse({ minPrice: " .29 ", maxPrice: "0.29" });
    assert.equal(query.minPrice, 0.29);
    assert.equal(query.maxPrice, 0.29);
    assert.equal(
      schema.parse({ maxPrice: "9999999999.99" }).maxPrice,
      9999999999.99,
    );
  }
  const admin = adminProductQuerySchema.parse({
    minPrice: "10",
    maxPrice: "20",
    isActive: "false",
    isFeatured: "true",
  });
  assert.equal(admin.isActive, false);
  assert.equal(admin.isFeatured, true);
});

test("rangos de precio rechazan formatos inválidos y rangos invertidos en ambos listados", () => {
  for (const schema of [publicProductQuerySchema, adminProductQuerySchema]) {
    for (const field of ["minPrice", "maxPrice"])
      for (const value of [
        "",
        " ",
        "-1",
        "1.001",
        "1e3",
        "0x10",
        "NaN",
        "Infinity",
        "10000000000",
        "1,50",
        true,
        null,
        1,
        ["1", "2"],
      ])
        assert.equal(
          schema.safeParse({ [field]: value }).success,
          false,
          `${field}: ${JSON.stringify(value)}`,
        );
    const result = schema.safeParse({ minPrice: "20", maxPrice: "10" });
    assert.equal(result.success, false);
    assert.ok(
      result.error.issues.some((issue) => issue.path.join(".") === "maxPrice"),
    );
  }
});
