const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, describe, it } = require("node:test");

const { createApp } = require("../src/app");
const defaultDatabase = require("../src/db/database");
const { migrate } = require("../src/db/migrate");
const { seed } = require("../src/db/seed");

const connectionString = process.env.TEST_DATABASE_URL;

describe("products API integration", { skip: !connectionString }, () => {
  let baseUrl;
  let categoryId;
  let pool;
  let server;
  let token;

  before(async () => {
    await migrate();
    pool = defaultDatabase.createPool({ connectionString, max: 5, ssl: false });
    await pool.query(
      `
        TRUNCATE TABLE
          administrators,
          categories,
          products
        RESTART IDENTITY CASCADE
      `,
    );

    const database = {
      checkConnection: () => pool.query("SELECT 1"),
      query: (text, values) => pool.query(text, values),
      withTransaction: (callback) =>
        defaultDatabase.withTransaction(callback, pool),
    };
    server = createApp({ database }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    const registerResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Product",
        lastName: "Admin",
        email: "products@example.com",
        phone: "+54 11 5555 2222",
        password: "StrongPass123!",
      }),
    });
    token = (await registerResponse.json()).data.token;

    const categoryResponse = await fetch(`${baseUrl}/api/v1/categories`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Graphics Cards",
        description: "Dedicated GPUs",
      }),
    });
    categoryId = (await categoryResponse.json()).data.id;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (pool) {
      await pool.end();
    }
    await defaultDatabase.close();
  });

  it("creates and exposes an active product with search and filters", async () => {
    const productValues = {
      categoryId,
      name: "Nova RTX 5090",
      description: "Ultra gaming graphics card with 32GB VRAM",
      imageUrl: "https://placehold.co/800x600?text=Nova+RTX+5090",
      price: 2499999.99,
      availability: "in_stock",
      isActive: true,
    };
    const unauthorizedResponse = await fetch(
      `${baseUrl}/api/v1/admin/products`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(productValues),
      },
    );
    assert.equal(unauthorizedResponse.status, 401);

    const createResponse = await fetch(`${baseUrl}/api/v1/admin/products`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(productValues),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()).data;
    assert.equal(created.name, productValues.name);
    assert.equal(created.price, productValues.price);
    assert.deepEqual(created.category, {
      id: categoryId,
      name: "Graphics Cards",
    });

    const listResponse = await fetch(
      `${baseUrl}/api/v1/products?q=ultra%20gaming&categoryId=${categoryId}&availability=in_stock&sort=price_desc`,
    );
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json();
    assert.equal(list.meta.total, 1);
    assert.equal(list.data[0].id, created.id);

    const getResponse = await fetch(`${baseUrl}/api/v1/products/${created.id}`);
    assert.equal(getResponse.status, 200);

    const conflictResponse = await fetch(`${baseUrl}/api/v1/admin/products`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...productValues, name: "nova rtx 5090" }),
    });
    assert.equal(conflictResponse.status, 409);
  });

  it("rejects malformed product values before creating or updating records", async () => {
    const original = (
      await pool.query("SELECT * FROM products WHERE name = 'Nova RTX 5090'")
    ).rows[0];
    const countBefore = (
      await pool.query("SELECT count(*)::integer AS count FROM products")
    ).rows[0].count;
    const values = {
      name: "Producto inválido",
      categoryId,
      description: "Prueba de validación",
      imageUrl: "https://example.com/product.png",
      price: 10,
    };
    for (const [field, invalid] of [
      ["price", null],
      ["price", true],
      ["price", ""],
      ["price", "1.23"],
      ["price", 1.001],
      ["price", 1.000000001],
      ["price", -1],
      ["imageUrl", "javascript:alert(1)"],
      ["imageUrl", "ftp://example.com/a.png"],
      ["imageUrl", "https:example.com"],
      ["imageUrl", "https://example.com/" + "a".repeat(2000)],
      ["categoryId", 2147483648],
      ["categoryId", true],
      ["categoryId", [categoryId]],
      ["categoryId", String(categoryId)],
    ]) {
      for (const [method, path, body] of [
        ["POST", "/api/v1/admin/products", { ...values, [field]: invalid }],
        [
          "PATCH",
          `/api/v1/admin/products/${original.id}`,
          { [field]: invalid },
        ],
      ]) {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        assert.equal(
          response.status,
          400,
          `${method}: ${field}=${JSON.stringify(invalid)}`,
        );
        const error = (await response.json()).error;
        assert.equal(error.code, "VALIDATION_ERROR");
        assert.ok(error.details.some((detail) => detail.field === field));
      }
    }
    for (const path of [
      "/api/v1/products/2147483648",
      "/api/v1/admin/products/2147483648",
      "/api/v1/categories/2147483648",
      "/api/v1/inquiries/2147483648",
      "/api/v1/products?categoryId=2147483648",
    ]) {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 400, path);
      assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
    }
    assert.deepEqual(
      (await pool.query("SELECT * FROM products WHERE id = $1", [original.id]))
        .rows[0],
      original,
    );
    assert.equal(
      (await pool.query("SELECT count(*)::integer AS count FROM products"))
        .rows[0].count,
      countBefore,
    );
  });

  it("stores valid cent values and zero without rounding or changing product flags", async () => {
    const id = (
      await pool.query("SELECT id FROM products WHERE name = 'Nova RTX 5090'")
    ).rows[0].id;
    try {
      for (const price of [0, 0.29, 123.45, 9999999999.99]) {
        const response = await fetch(`${baseUrl}/api/v1/admin/products/${id}`, {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ price }),
        });
        assert.equal(response.status, 200);
        const product = (await response.json()).data;
        assert.equal(product.price, price);
        assert.equal(product.isActive, true);
        assert.equal(product.isFeatured, false);
        assert.equal(
          Number(
            (await pool.query("SELECT price FROM products WHERE id = $1", [id]))
              .rows[0].price,
          ),
          price,
        );
      }
    } finally {
      await pool.query("UPDATE products SET price = 2499999.99 WHERE id = $1", [
        id,
      ]);
    }
  });

  it("filters inclusive price bounds with other filters and correct paginated totals", async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };
    const response = await fetch(`${baseUrl}/api/v1/categories`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "Rango de precios",
        description: "Pruebas",
      }),
    });
    assert.equal(response.status, 201);
    const rangeCategoryId = (await response.json()).data.id;
    const list = async (query, admin = false) => {
      const response = await fetch(
        `${baseUrl}/api/v1/${admin ? "admin/" : ""}products?categoryId=${rangeCategoryId}&sort=price_asc&${query}`,
        { headers },
      );
      assert.equal(response.status, 200);
      return response.json();
    };
    try {
      for (const values of [
        { price: 0, isFeatured: true },
        { price: 10.5, isFeatured: true },
        { price: 20.5 },
        { price: 25.5, availability: "out_of_stock", isFeatured: true },
        { price: 30.5, isActive: false, isFeatured: true },
      ]) {
        const created = await fetch(`${baseUrl}/api/v1/admin/products`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: `Componente rango ${values.price}`,
            categoryId: rangeCategoryId,
            description: "Componente para filtros",
            imageUrl: "https://example.com/a.png",
            ...values,
          }),
        });
        assert.equal(created.status, 201);
      }
      for (const [query, expected] of [
        ["minPrice=10.50&maxPrice=20.50", [10.5, 20.5]],
        ["minPrice=20.50", [20.5, 25.5]],
        ["maxPrice=10.50", [0, 10.5]],
        ["maxPrice=0", [0]],
        ["minPrice=10.50&maxPrice=10.50", [10.5]],
        ["minPrice=11&maxPrice=20", []],
        [
          "minPrice=10.50&maxPrice=25.50&availability=in_stock&isFeatured=true&q=componente",
          [10.5],
        ],
      ]) {
        const result = await list(query);
        assert.deepEqual(
          result.data.map((product) => product.price),
          expected,
        );
        assert.equal(result.meta.total, expected.length);
      }
      const first = await list("minPrice=0&maxPrice=25.50&limit=2&page=1");
      const second = await list("minPrice=0&maxPrice=25.50&limit=2&page=2");
      assert.equal(first.meta.total, 4);
      assert.equal(second.meta.total, 4);
      assert.deepEqual(
        first.data.map((product) => product.price),
        [0, 10.5],
      );
      assert.deepEqual(
        second.data.map((product) => product.price),
        [20.5, 25.5],
      );
      const hidden = await list(
        "minPrice=25.50&maxPrice=30.50&isActive=false",
        true,
      );
      assert.equal(hidden.meta.total, 1);
      assert.deepEqual(
        hidden.data.map((product) => product.price),
        [30.5],
      );
      assert.equal((await list("")).meta.total, 4);
    } finally {
      await pool.query("DELETE FROM products WHERE category_id = $1", [
        rangeCategoryId,
      ]);
      await pool.query("DELETE FROM categories WHERE id = $1", [
        rangeCategoryId,
      ]);
    }
  });

  it("returns validation errors for malformed price filters in both routes", async () => {
    for (const prefix of ["", "admin/"])
      for (const query of [
        "minPrice=-1",
        "maxPrice=1.001",
        "minPrice=100&maxPrice=99",
        "maxPrice=Infinity",
        "minPrice=true",
        "minPrice=1&minPrice=2",
        "maxPrice=10000000000",
        "minPrice=0x10",
        "minPrice=",
      ]) {
        const response = await fetch(
          `${baseUrl}/api/v1/${prefix}products?${query}`,
          { headers: { authorization: `Bearer ${token}` } },
        );
        assert.equal(response.status, 400, `${prefix}: ${query}`);
        assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
      }
  });

  it("deactivates products and retains administrator visibility", async () => {
    const productResult = await pool.query(
      "SELECT id FROM products WHERE name = 'Nova RTX 5090'",
    );
    const productId = productResult.rows[0].id;
    const updateResponse = await fetch(
      `${baseUrl}/api/v1/admin/products/${productId}`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ isActive: false, availability: "out_of_stock" }),
      },
    );
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).data.isActive, false);

    const publicResponse = await fetch(
      `${baseUrl}/api/v1/products/${productId}`,
    );
    assert.equal(publicResponse.status, 404);

    const adminGetResponse = await fetch(
      `${baseUrl}/api/v1/admin/products/${productId}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    assert.equal(adminGetResponse.status, 200);
    const adminProduct = (await adminGetResponse.json()).data;
    assert.equal(adminProduct.id, productId);
    assert.equal(adminProduct.isActive, false);

    const adminListResponse = await fetch(
      `${baseUrl}/api/v1/admin/products?isActive=false`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    assert.equal(adminListResponse.status, 200);
    const adminList = await adminListResponse.json();
    assert.equal(adminList.meta.total, 1);
    assert.equal(adminList.data[0].id, productId);

    const categoryDeleteResponse = await fetch(
      `${baseUrl}/api/v1/categories/${categoryId}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      },
    );
    assert.equal(categoryDeleteResponse.status, 409);

    const deleteResponse = await fetch(
      `${baseUrl}/api/v1/admin/products/${productId}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      },
    );
    assert.equal(deleteResponse.status, 204);

    const categoryDeleteAfterProduct = await fetch(
      `${baseUrl}/api/v1/categories/${categoryId}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      },
    );
    assert.equal(categoryDeleteAfterProduct.status, 204);
  });

  it("loads at least 20 products with an idempotent seed", async () => {
    await seed();
    await seed();

    const result = await pool.query(
      "SELECT count(*)::integer AS count FROM products",
    );
    assert.equal(result.rows[0].count, 20);

    const categoryResult = await pool.query(
      "SELECT name, description FROM categories ORDER BY id",
    );
    assert.deepEqual(
      categoryResult.rows.map(({ name }) => name).sort(),
      [
        "Almacenamiento",
        "Fuentes de alimentación",
        "Memoria RAM",
        "Placas madre",
        "Procesadores",
        "Tarjetas gráficas",
      ].sort(),
    );
    assert.deepEqual(
      Object.fromEntries(
        categoryResult.rows.map(({ name, description }) => [name, description]),
      ),
      {
        Almacenamiento: "Unidades SSD NVMe y almacenamiento de alta capacidad",
        "Fuentes de alimentación":
          "Fuentes de alimentación modulares y no modulares confiables",
        "Memoria RAM":
          "Kits de memoria RAM DDR4 y DDR5 para computadoras de escritorio",
        "Placas madre": "Placas madre para plataformas AMD e Intel",
        Procesadores:
          "Procesadores para computadoras de videojuegos y productividad",
        "Tarjetas gráficas":
          "Tarjetas gráficas dedicadas para videojuegos de alto rendimiento",
      },
    );

    const publicResponse = await fetch(
      `${baseUrl}/api/v1/products?page=1&limit=100`,
    );
    assert.equal(publicResponse.status, 200);
    assert.equal((await publicResponse.json()).meta.total, 20);

    const searchResponse = await fetch(
      `${baseUrl}/api/v1/products?q=videojuegos&page=1&limit=100`,
    );
    assert.equal(searchResponse.status, 200);
    const searchResult = await searchResponse.json();
    assert.equal(searchResult.meta.total, 20);
    assert.ok(
      searchResult.data.every((product) =>
        product.description.includes("videojuegos"),
      ),
    );
  });
});
