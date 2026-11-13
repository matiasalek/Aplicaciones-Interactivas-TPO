const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  createProductSchema,
  updateProductSchema,
  publicProductQuerySchema,
  adminProductQuerySchema,
} = require("../src/validators/product.schemas");

const product = {
  name: "Componente",
  categoryId: 1,
  description: "Componente de prueba",
  imageUrl: "https://example.com/product.png",
  price: 100,
};

test("destacados es opcional al crear y exige booleanos JSON", () => {
  assert.equal(createProductSchema.parse(product).isFeatured, false);
  for (const isFeatured of [true, false]) {
    assert.equal(
      createProductSchema.parse({ ...product, isFeatured }).isFeatured,
      isFeatured,
    );
    assert.deepEqual(updateProductSchema.parse({ isFeatured }), { isFeatured });
  }
  for (const isFeatured of ["true", "false", 1, 0, null, [], {}]) {
    assert.equal(
      createProductSchema.safeParse({ ...product, isFeatured }).success,
      false,
    );
    assert.equal(updateProductSchema.safeParse({ isFeatured }).success, false);
  }
});

test("editar otros campos no agrega ni modifica la selección de destacado", () => {
  assert.deepEqual(updateProductSchema.parse({ price: 250 }), { price: 250 });
  assert.deepEqual(
    updateProductSchema.parse({ isActive: false, isFeatured: true }),
    { isActive: false, isFeatured: true },
  );
  assert.equal(updateProductSchema.safeParse({}).success, false);
});

test("los filtros de destacados distinguen true, false y ausencia", () => {
  for (const schema of [publicProductQuerySchema, adminProductQuerySchema]) {
    assert.equal(schema.parse({}).isFeatured, undefined);
    assert.equal(schema.parse({ isFeatured: "true" }).isFeatured, true);
    assert.equal(schema.parse({ isFeatured: "false" }).isFeatured, false);
    for (const isFeatured of [
      "",
      "1",
      "otro",
      ["true", "false"],
      true,
      false,
    ]) {
      assert.equal(schema.safeParse({ isFeatured }).success, false);
    }
  }
  const query = adminProductQuerySchema.parse({
    isActive: "false",
    isFeatured: "true",
  });
  assert.equal(query.isActive, false);
  assert.equal(query.isFeatured, true);
});
