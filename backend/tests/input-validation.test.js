const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  createProductSchema,
  updateProductSchema,
  publicProductQuerySchema,
} = require("../src/validators/product.schemas");
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("../src/validators/auth.schemas");
const { createInquirySchema } = require("../src/validators/inquiry.schemas");
const { storeSchema } = require("../src/validators/store.schemas");

const product = {
  name: "Componente",
  categoryId: 1,
  description: "Componente",
  imageUrl: "https://example.com/a.png",
  price: 0.29,
};
const account = {
  firstName: "Ana",
  lastName: "Prueba",
  email: "ana@example.com",
  phone: "+54 (11) 4444-5555",
  password: "Segura123!",
};
const inquiry = {
  name: "Ana",
  email: "ana@example.com",
  subject: "Consulta",
  message: "Hola",
};
const store = {
  name: "Comercio",
  description: "Componentes",
  address: "Dirección",
  phone: "1144445555",
  openingHours: "Lunes",
  socialLinks: {},
};

test("precio exige un número JSON finito con hasta dos decimales", () => {
  for (const price of [0, 0.01, 0.29, 1.1, 123.45, 9999999999.99]) {
    assert.equal(createProductSchema.parse({ ...product, price }).price, price);
    assert.equal(updateProductSchema.parse({ price }).price, price);
  }
  for (const price of [
    null,
    true,
    false,
    [],
    [1],
    {},
    "",
    " ",
    "1.23",
    -1,
    1.001,
    1.000000001,
    0.0000001,
    10000000000,
    Infinity,
    NaN,
  ]) {
    assert.equal(
      createProductSchema.safeParse({ ...product, price }).success,
      false,
      String(price),
    );
    assert.equal(
      updateProductSchema.safeParse({ price }).success,
      false,
      String(price),
    );
  }
});

test("categoría exige un entero JSON seguro; el filtro admite identificadores en texto", () => {
  for (const categoryId of [
    true,
    false,
    null,
    [],
    [1],
    {},
    "",
    "1",
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(
      createProductSchema.safeParse({ ...product, categoryId }).success,
      false,
    );
    assert.equal(updateProductSchema.safeParse({ categoryId }).success, false);
  }
  assert.equal(
    publicProductQuerySchema.parse({ categoryId: "1" }).categoryId,
    1,
  );
  for (const categoryId of [
    true,
    ["1"],
    "1.5",
    "0",
    "1e2",
    String(Number.MAX_SAFE_INTEGER + 1),
  ])
    assert.equal(
      publicProductQuerySchema.safeParse({ categoryId }).success,
      false,
    );
});

test("imágenes y redes admiten únicamente URLs completas HTTP/HTTPS de hasta 2000 caracteres", () => {
  for (const imageUrl of [
    "https://example.com/a.png",
    "HTTP://localhost:3000/a",
    " https://example.com ",
  ]) {
    assert.equal(
      createProductSchema.safeParse({ ...product, imageUrl }).success,
      true,
    );
    assert.equal(updateProductSchema.safeParse({ imageUrl }).success, true);
    assert.equal(
      storeSchema.safeParse({ ...store, socialLinks: { website: imageUrl } })
        .success,
      true,
    );
  }
  for (const imageUrl of [
    "ftp://example.com/a.png",
    "javascript:alert(1)",
    "data:image/png;base64,AA",
    "//example.com/a",
    "https:example.com",
    "https://example.com/" + "a".repeat(2000),
    null,
    1,
  ]) {
    assert.equal(
      createProductSchema.safeParse({ ...product, imageUrl }).success,
      false,
      String(imageUrl),
    );
    assert.equal(
      updateProductSchema.safeParse({ imageUrl }).success,
      false,
      String(imageUrl),
    );
    assert.equal(
      storeSchema.safeParse({ ...store, socialLinks: { website: imageUrl } })
        .success,
      false,
      String(imageUrl),
    );
  }
  assert.equal(
    createProductSchema.parse({
      ...product,
      imageUrl: " https://example.com/a ",
    }).imageUrl,
    "https://example.com/a",
  );
});

test("correos se normalizan antes de validar en autenticación, perfil y consultas", () => {
  const schemas = [
    [registerSchema, account],
    [loginSchema, { email: account.email, password: account.password }],
    [updateProfileSchema, { email: account.email }],
    [forgotPasswordSchema, { email: account.email }],
    [createInquirySchema, inquiry],
  ];
  for (const [schema, values] of schemas) {
    assert.equal(
      schema.parse({ ...values, email: " O'Connor+pc@EXAMPLE.COM " }).email,
      "o'connor+pc@example.com",
    );
    for (const email of [
      ".ana@example.com",
      "ana.@example.com",
      "ana..p@example.com",
      "ana@exam_ple.com",
      "ana@example.c",
      "ana@localhost",
    ])
      assert.equal(
        schema.safeParse({ ...values, email }).success,
        false,
        email,
      );
  }
});

test("teléfonos permiten formatos locales e internacionales y rechazan letras o cadenas sin dígitos", () => {
  for (const [schema, values] of [
    [registerSchema, account],
    [updateProfileSchema, {}],
    [createInquirySchema, inquiry],
    [storeSchema, store],
  ]) {
    for (const phone of [
      "11444",
      "+54 (11) 4444-5555",
      "11.4444.5555",
      " 1144445555 ",
    ])
      assert.equal(schema.parse({ ...values, phone }).phone, phone.trim());
    for (const phone of [
      "abcde",
      "-----",
      "12-34",
      "11+44445555",
      "114444hola",
      "1".repeat(51),
    ])
      assert.equal(
        schema.safeParse({ ...values, phone }).success,
        false,
        phone,
      );
  }
  assert.equal(createInquirySchema.parse(inquiry).phone, null);
  assert.equal(
    createInquirySchema.parse({ ...inquiry, phone: null }).phone,
    null,
  );
});

test("contraseñas nuevas no se truncan al superar 72 bytes UTF-8", () => {
  for (const [schema, values] of [
    [registerSchema, account],
    [resetPasswordSchema, { token: "a".repeat(64) }],
  ]) {
    for (const password of ["a".repeat(72), "é".repeat(36), "😀".repeat(18)])
      assert.equal(schema.safeParse({ ...values, password }).success, true);
    for (const password of ["a".repeat(73), "é".repeat(37), "😀".repeat(19)])
      assert.equal(schema.safeParse({ ...values, password }).success, false);
  }
  assert.equal(
    loginSchema.safeParse({ email: account.email, password: "é".repeat(40) })
      .success,
    true,
  );
});

test("identificadores fuera de integer se rechazan antes de consultar PostgreSQL", () => {
  const { productIdSchema } = require("../src/validators/product.schemas");
  const { categoryIdSchema } = require("../src/validators/category.schemas");
  const { inquiryIdSchema } = require("../src/validators/inquiry.schemas");
  for (const schema of [productIdSchema, categoryIdSchema, inquiryIdSchema]) {
    assert.equal(schema.parse({ id: "2147483647" }).id, 2147483647);
    for (const id of ["2147483648", "9007199254740991", "0", "-1", "1.5"])
      assert.equal(schema.safeParse({ id }).success, false);
  }
  assert.equal(
    createProductSchema.safeParse({ ...product, categoryId: 2147483648 })
      .success,
    false,
  );
  assert.equal(
    updateProductSchema.safeParse({ categoryId: 2147483648 }).success,
    false,
  );
  assert.equal(
    publicProductQuerySchema.safeParse({ categoryId: "2147483648" }).success,
    false,
  );
});
