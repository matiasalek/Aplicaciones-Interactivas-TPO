const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, describe, it } = require("node:test");
const { createApp } = require("../src/app");
const database = require("../src/db/database");
const { migrate } = require("../src/db/migrate");
const { seed } = require("../src/db/seed");

const connectionString = process.env.TEST_DATABASE_URL;

describe(
  "featured products API integration",
  { skip: !connectionString },
  () => {
    let baseUrl, server, pool, categoryId, headers, administratorId;
    const products = [];

    async function jsonRequest(path, method, body, authenticated = true) {
      return fetch(`${baseUrl}/api/v1${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(authenticated ? headers : {}),
        },
        body: JSON.stringify(body),
      });
    }

    async function list(query, admin = false) {
      const response = await fetch(
        `${baseUrl}/api/v1/${admin ? "admin/" : ""}products?categoryId=${categoryId}&${query}`,
        { headers: admin ? headers : {} },
      );
      assert.equal(response.status, 200);
      return response.json();
    }

    before(async () => {
      await migrate();
      pool = database.createPool({ connectionString, max: 5, ssl: false });
      server = createApp({
        database: {
          checkConnection: () => pool.query("SELECT 1"),
          query: (text, values) => pool.query(text, values),
        },
      }).listen(0, "127.0.0.1");
      await once(server, "listening");
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      const registration = await jsonRequest(
        "/auth/register",
        "POST",
        {
          firstName: "Featured",
          lastName: "Admin",
          email: `featured-${Date.now()}@example.com`,
          phone: "1144445555",
          password: "StrongPass123!",
        },
        false,
      );
      assert.equal(registration.status, 201);
      const { data } = await registration.json();
      headers = { authorization: `Bearer ${data.token}` };
      // Obtener el identificador sin acoplarse a la forma del perfil de registro.
      administratorId = (
        await pool.query("SELECT id FROM administrators WHERE email = $1", [
          data.user.email,
        ])
      ).rows[0].id;
      const category = await jsonRequest("/categories", "POST", {
        name: `Destacados ${Date.now()}`,
        description: "Pruebas aisladas",
      });
      assert.equal(category.status, 201);
      categoryId = (await category.json()).data.id;
      for (const values of [
        { name: "Destacado disponible", price: 100, isFeatured: true },
        {
          name: "Destacado agotado",
          price: 200,
          isFeatured: true,
          availability: "out_of_stock",
        },
        {
          name: "Destacado oculto",
          price: 300,
          isFeatured: true,
          isActive: false,
        },
        { name: "Sin destacar", price: 400, isFeatured: false },
        { name: "Valor por defecto", price: 500 },
      ]) {
        const response = await jsonRequest("/admin/products", "POST", {
          categoryId,
          description: "Componente de prueba",
          imageUrl: "https://example.com/test.png",
          availability: "in_stock",
          ...values,
        });
        assert.equal(response.status, 201);
        products.push((await response.json()).data);
      }
    });

    after(async () => {
      if (server)
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      if (pool) {
        if (categoryId) {
          await pool.query("DELETE FROM products WHERE category_id = $1", [
            categoryId,
          ]);
          await pool.query("DELETE FROM categories WHERE id = $1", [
            categoryId,
          ]);
        }
        if (administratorId)
          await pool.query("DELETE FROM administrators WHERE id = $1", [
            administratorId,
          ]);
        await pool.end();
      }
      await database.close();
    });

    it("persists true, false and the default in listings and details", async () => {
      assert.deepEqual(
        products.map((product) => product.isFeatured),
        [true, true, true, false, false],
      );
      const rows = (
        await pool.query(
          "SELECT is_featured FROM products WHERE category_id = $1 ORDER BY id",
          [categoryId],
        )
      ).rows;
      assert.deepEqual(
        rows.map((row) => row.is_featured),
        [true, true, true, false, false],
      );
      const response = await fetch(
        `${baseUrl}/api/v1/products/${products[0].id}`,
      );
      assert.equal((await response.json()).data.isFeatured, true);
      const all = await list("limit=100");
      assert.equal(all.meta.total, 4);
      assert.equal((await list("isFeatured=false")).meta.total, 2);
    });

    it("combines featured filtering with public visibility, search, availability, sorting and pagination", async () => {
      const first = await list("isFeatured=true&sort=price_asc&limit=1&page=1");
      const second = await list(
        "isFeatured=true&sort=price_asc&limit=1&page=2",
      );
      assert.equal(first.meta.total, 2);
      assert.equal(second.meta.total, 2);
      assert.deepEqual(
        first.data.map((p) => p.id),
        [products[0].id],
      );
      assert.deepEqual(
        second.data.map((p) => p.id),
        [products[1].id],
      );
      const filtered = await list(
        "isFeatured=true&q=agotado&availability=out_of_stock",
      );
      assert.equal(filtered.meta.total, 1);
      assert.equal(filtered.data[0].id, products[1].id);
      const hidden = await list("isFeatured=true&isActive=false", true);
      assert.equal(hidden.meta.total, 1);
      assert.equal(hidden.data[0].id, products[2].id);
      assert.equal(
        (await fetch(`${baseUrl}/api/v1/products/${products[2].id}`)).status,
        404,
      );
      const empty = await list("isFeatured=true&q=inexistente");
      assert.equal(empty.meta.total, 0);
      assert.deepEqual(empty.data, []);
    });

    it("requires authentication and rejects invalid featured values", async () => {
      const path = `/admin/products/${products[0].id}`;
      assert.equal(
        (await jsonRequest(path, "PATCH", { isFeatured: false }, false)).status,
        401,
      );
      for (const value of ["false", 1, null]) {
        const response = await jsonRequest(path, "PATCH", {
          isFeatured: value,
        });
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
      }
      for (const prefix of ["", "admin/"]) {
        const response = await fetch(
          `${baseUrl}/api/v1/${prefix}products?isFeatured=otro`,
          { headers },
        );
        assert.equal(response.status, 400);
      }
    });

    it("retains the selection on deactivation, reactivation and unrelated edits, and allows removing it", async () => {
      const path = `/admin/products/${products[0].id}`;
      let response = await jsonRequest(path, "PATCH", { isActive: false });
      assert.equal((await response.json()).data.isFeatured, true);
      assert.equal((await list("isFeatured=true")).meta.total, 1);
      response = await jsonRequest(path, "PATCH", {
        price: 150,
        isActive: true,
      });
      const edited = (await response.json()).data;
      assert.equal(edited.price, 150);
      assert.equal(edited.isFeatured, true);
      assert.equal((await list("isFeatured=true")).meta.total, 2);
      response = await jsonRequest(path, "PATCH", { isFeatured: false });
      const removed = (await response.json()).data;
      assert.equal(removed.isActive, true);
      assert.equal(removed.isFeatured, false);
      assert.equal((await list("isFeatured=true")).meta.total, 1);
      response = await jsonRequest(
        `/admin/products/${products[2].id}`,
        "PATCH",
        { isFeatured: false },
      );
      assert.equal((await response.json()).data.isActive, false);
    });

    it("keeps administrator selections when the seed runs again", async () => {
      await seed();
      const { rows } = await pool.query(
        "SELECT id FROM products WHERE name = 'AMD Ryzen 5 7600'",
      );
      const id = rows[0].id;
      const original = (
        await pool.query("SELECT is_featured FROM products WHERE id = $1", [id])
      ).rows[0].is_featured;
      try {
        await pool.query(
          "UPDATE products SET is_featured = true WHERE id = $1",
          [id],
        );
        await seed();
        assert.equal(
          (
            await pool.query("SELECT is_featured FROM products WHERE id = $1", [
              id,
            ])
          ).rows[0].is_featured,
          true,
        );
      } finally {
        await pool.query("UPDATE products SET is_featured = $1 WHERE id = $2", [
          original,
          id,
        ]);
      }
    });
  },
);
