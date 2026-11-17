const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  createProductSchema,
  updateProductSchema,
} = require("../src/validators/product.schemas");

const product = {
  name: "Componente",
  categoryId: 1,
  description: "Componente de prueba",
  price: 100,
};
const urls = ["https://example.com/a.png", "https://example.com/b.png"];

test("las rutas locales se admiten solo para imágenes WebP del catálogo", () => {
  const photo = "/api/v1/media/products/ryzen-5-7600.webp";
  assert.deepEqual(
    updateProductSchema.parse({ imageUrls: [photo, urls[0]] }).imageUrls,
    [photo, urls[0]],
  );
  assert.equal(
    updateProductSchema.safeParse({ imageUrls: [photo, photo] }).success,
    false,
  );
  for (const imageUrl of [
    "/api/v1/media/products/../other.webp",
    "/api/v1/media/products/credits.json",
    `${photo}?other=1`,
    "//example.com/asset.webp",
  ]) {
    assert.equal(updateProductSchema.safeParse({ imageUrl }).success, false);
  }
});

test("alta exige una galería o una imagen anterior, sin mezclar contratos", () => {
  assert.deepEqual(
    createProductSchema.parse({ ...product, imageUrls: urls }).imageUrls,
    urls,
  );
  assert.equal(
    createProductSchema.parse({ ...product, imageUrl: urls[0] }).imageUrl,
    urls[0],
  );
  assert.equal(createProductSchema.safeParse(product).success, false);
  assert.equal(
    createProductSchema.safeParse({
      ...product,
      imageUrl: urls[0],
      imageUrls: urls,
    }).success,
    false,
  );
  assert.equal(
    updateProductSchema.safeParse({ imageUrl: urls[0], imageUrls: urls })
      .success,
    false,
  );
});

test("galerías admiten entre una y diez URLs completas HTTP/HTTPS", () => {
  const ten = Array.from(
    { length: 10 },
    (_, index) => `https://example.com/${index}.png`,
  );
  for (const imageUrls of [[urls[0]], ten]) {
    assert.equal(
      createProductSchema.safeParse({ ...product, imageUrls }).success,
      true,
    );
    assert.equal(updateProductSchema.safeParse({ imageUrls }).success, true);
  }
  for (const imageUrls of [
    [],
    [...ten, "https://example.com/11.png"],
    null,
    urls[0],
    {},
    [null],
    [1],
    [""],
    ["  "],
    ["ftp://example.com/a.png"],
    ["javascript:alert(1)"],
    ["https:example.com"],
    ["https://example.com/" + "a".repeat(2000)],
  ]) {
    assert.equal(
      createProductSchema.safeParse({ ...product, imageUrls }).success,
      false,
      JSON.stringify(imageUrls),
    );
    assert.equal(
      updateProductSchema.safeParse({ imageUrls }).success,
      false,
      JSON.stringify(imageUrls),
    );
  }
});

test("galerías conservan orden, recortan espacios y rechazan URLs repetidas", () => {
  assert.deepEqual(
    updateProductSchema.parse({
      imageUrls: [" https://example.com/b.png ", urls[0]],
    }).imageUrls,
    [urls[1], urls[0]],
  );
  for (const imageUrls of [
    [urls[0], urls[0]],
    ["https://example.com", " HTTPS://EXAMPLE.COM:443/ "],
  ]) {
    const result = updateProductSchema.safeParse({ imageUrls });
    assert.equal(result.success, false);
    assert.ok(
      result.error.issues.some(
        (issue) => issue.path.join(".") === "imageUrls.1",
      ),
    );
  }
});

test("ediciones de otros campos no agregan imágenes ni borran la galería", () => {
  assert.deepEqual(updateProductSchema.parse({ price: 0.29 }), { price: 0.29 });
  assert.deepEqual(updateProductSchema.parse({ imageUrls: urls }), {
    imageUrls: urls,
  });
  assert.deepEqual(updateProductSchema.parse({ imageUrl: urls[0] }), {
    imageUrl: urls[0],
  });
  assert.equal(updateProductSchema.safeParse({}).success, false);
});
