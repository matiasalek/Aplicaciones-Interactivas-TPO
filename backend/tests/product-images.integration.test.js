const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, describe, it } = require("node:test");
const { createApp } = require("../src/app");
const database = require("../src/db/database");
const { migrate } = require("../src/db/migrate");
const { seed } = require("../src/db/seed");

describe(
  "product image galleries integration",
  { skip: !process.env.TEST_DATABASE_URL },
  () => {
    let pool, server, baseUrl, headers, categoryId, administratorId, product;
    const unique = Date.now();
    const urls = [
      "https://example.com/front.png",
      "https://example.com/back.png",
      "https://example.com/side.png",
    ];

    async function write(path, method, body, authenticated = true) {
      return fetch(`${baseUrl}/api/v1${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          ...(authenticated ? headers : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }
    async function create(name, changes = {}) {
      const response = await write("/admin/products", "POST", {
        name: `${name} ${unique}`,
        categoryId,
        description: "Galería de prueba",
        price: 123.45,
        imageUrls: urls,
        ...changes,
      });
      assert.equal(response.status, 201);
      return (await response.json()).data;
    }
    async function get(id, admin = false) {
      const response = await fetch(
        `${baseUrl}/api/v1/${admin ? "admin/" : ""}products/${id}`,
        { headers },
      );
      assert.equal(response.status, 200);
      return (await response.json()).data;
    }
    async function rows(id) {
      return (
        await pool.query(
          "SELECT position, url FROM product_images WHERE product_id = $1 ORDER BY position",
          [id],
        )
      ).rows;
    }

    before(async () => {
      await migrate();
      pool = database.createPool({
        connectionString: process.env.TEST_DATABASE_URL,
        max: 5,
        ssl: false,
      });
      server = createApp({
        database: {
          query: (text, values) => pool.query(text, values),
          checkConnection: () => pool.query("SELECT 1"),
          withTransaction: (callback) =>
            database.withTransaction(callback, pool),
        },
      }).listen(0, "127.0.0.1");
      await once(server, "listening");
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      const registration = await write(
        "/auth/register",
        "POST",
        {
          firstName: "Ana",
          lastName: "Galerías",
          email: `galeria-${unique}@example.com`,
          phone: "1144445555",
          password: "Segura123!",
        },
        false,
      );
      assert.equal(registration.status, 201);
      const { data } = await registration.json();
      headers = { authorization: `Bearer ${data.token}` };
      administratorId = data.user.id;
      const response = await write("/categories", "POST", {
        name: `Galerías ${unique}`,
        description: "Pruebas aisladas",
      });
      assert.equal(response.status, 201);
      categoryId = (await response.json()).data.id;
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

    it("creates galleries with ordered images in details and paginated listings", async () => {
      product = await create("Galería principal");
      assert.deepEqual(product.imageUrls, urls);
      assert.equal(product.imageUrl, urls[0]);
      assert.deepEqual((await get(product.id)).imageUrls, urls);
      assert.deepEqual(
        await rows(product.id),
        urls.map((url, position) => ({ position, url })),
      );
      for (const prefix of ["", "admin/"]) {
        const response = await fetch(
          `${baseUrl}/api/v1/${prefix}products?categoryId=${categoryId}&page=1&limit=1`,
          { headers },
        );
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.meta.total, 1);
        assert.equal(result.data.length, 1);
        assert.deepEqual(result.data[0].imageUrls, urls);
      }
    });

    it("changes the primary image, removes images and preserves galleries in unrelated edits", async () => {
      const ordered = [urls[2], urls[0]];
      const response = await write(`/admin/products/${product.id}`, "PATCH", {
        imageUrls: ordered,
        isFeatured: true,
      });
      assert.equal(response.status, 200);
      const updated = (await response.json()).data;
      assert.equal(updated.imageUrl, ordered[0]);
      assert.deepEqual(updated.imageUrls, ordered);
      assert.deepEqual(
        await rows(product.id),
        ordered.map((url, position) => ({ position, url })),
      );
      const edited = await write(`/admin/products/${product.id}`, "PATCH", {
        price: 0.29,
      });
      assert.equal(edited.status, 200);
      assert.deepEqual((await edited.json()).data.imageUrls, ordered);
      assert.equal((await get(product.id)).isFeatured, true);
    });

    it("rejects invalid galleries before writes and requires authorization", async () => {
      const before = (
        await pool.query("SELECT * FROM products WHERE id = $1", [product.id])
      ).rows[0];
      const beforeImages = await rows(product.id);
      const count = (
        await pool.query(
          "SELECT count(*)::integer AS count FROM products WHERE category_id = $1",
          [categoryId],
        )
      ).rows[0].count;
      for (const imageUrls of [
        [],
        null,
        urls[0],
        [null],
        [""],
        ["ftp://example.com/a.png"],
        ["javascript:alert(1)"],
        [urls[0], urls[0]],
        ["https://example.com", "HTTPS://EXAMPLE.COM:443/"],
        Array.from({ length: 11 }, (_, i) => `https://example.com/${i}.png`),
        ["https://example.com/" + "a".repeat(2000)],
      ]) {
        for (const [path, method, data] of [
          [`/admin/products/${product.id}`, "PATCH", { imageUrls, price: 999 }],
          [
            "/admin/products",
            "POST",
            {
              name: `Inválido ${unique}`,
              categoryId,
              description: "Prueba",
              price: 100,
              imageUrls,
            },
          ],
        ]) {
          const response = await write(path, method, data);
          assert.equal(response.status, 400, JSON.stringify(imageUrls));
          const error = (await response.json()).error;
          assert.equal(error.code, "VALIDATION_ERROR");
          assert.ok(
            error.details.some((detail) =>
              detail.field.startsWith("imageUrls"),
            ),
          );
        }
      }
      assert.equal(
        (
          await write(
            `/admin/products/${product.id}`,
            "PATCH",
            { imageUrls: urls },
            false,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await write(`/admin/products/${product.id}`, "PATCH", {
            imageUrl: urls[0],
            imageUrls: urls,
          })
        ).status,
        400,
      );
      assert.deepEqual(
        (await pool.query("SELECT * FROM products WHERE id = $1", [product.id]))
          .rows[0],
        before,
      );
      assert.deepEqual(await rows(product.id), beforeImages);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::integer AS count FROM products WHERE category_id = $1",
            [categoryId],
          )
        ).rows[0].count,
        count,
      );
    });

    it("keeps the legacy imageUrl contract without losing secondary images", async () => {
      const legacyResponse = await write("/admin/products", "POST", {
        name: `Anterior ${unique}`,
        categoryId,
        description: "Compatibilidad",
        price: 10,
        imageUrl: urls[0],
      });
      assert.equal(legacyResponse.status, 201);
      const legacy = (await legacyResponse.json()).data;
      assert.deepEqual(legacy.imageUrls, [urls[0]]);
      assert.equal(legacy.imageUrl, urls[0]);
      await write(`/admin/products/${legacy.id}`, "PATCH", { imageUrls: urls });
      let response = await write(`/admin/products/${legacy.id}`, "PATCH", {
        imageUrl: "https://example.com/new.png",
      });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data.imageUrls, [
        "https://example.com/new.png",
        urls[1],
        urls[2],
      ]);
      response = await write(`/admin/products/${legacy.id}`, "PATCH", {
        imageUrl: urls[1],
      });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data.imageUrls, [
        urls[1],
        urls[2],
      ]);
      assert.deepEqual(
        await rows(legacy.id),
        [urls[1], urls[2]].map((url, position) => ({ position, url })),
      );
    });

    it("rolls back the product and every image if an image insert fails", async () => {
      const before = (
        await pool.query("SELECT * FROM products WHERE id = $1", [product.id])
      ).rows[0];
      const beforeImages = await rows(product.id);
      await pool.query(`CREATE FUNCTION reject_gallery_image_for_test() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.url = 'https://example.com/fail.png' THEN RAISE EXCEPTION 'simulated image insert failure'; END IF; RETURN NEW; END $$`);
      await pool.query(
        "CREATE TRIGGER gallery_failure_for_test BEFORE INSERT ON product_images FOR EACH ROW EXECUTE FUNCTION reject_gallery_image_for_test()",
      );
      try {
        const response = await write(`/admin/products/${product.id}`, "PATCH", {
          imageUrls: [urls[1], "https://example.com/fail.png"],
          price: 999,
        });
        assert.equal(response.status, 500);
        assert.deepEqual(
          (
            await pool.query("SELECT * FROM products WHERE id = $1", [
              product.id,
            ])
          ).rows[0],
          before,
        );
        assert.deepEqual(await rows(product.id), beforeImages);
        const failedCreate = await write("/admin/products", "POST", {
          name: `Fallo ${unique}`,
          categoryId,
          description: "Rollback",
          price: 10,
          imageUrls: [urls[0], "https://example.com/fail.png"],
        });
        assert.equal(failedCreate.status, 500);
        assert.equal(
          (
            await pool.query("SELECT id FROM products WHERE name = $1", [
              `Fallo ${unique}`,
            ])
          ).rows.length,
          0,
        );
      } finally {
        await pool.query(
          "DROP TRIGGER gallery_failure_for_test ON product_images",
        );
        await pool.query("DROP FUNCTION reject_gallery_image_for_test()");
      }
    });

    it("serializes simultaneous replacements without mixing image collections", async () => {
      const first = [
        "https://example.com/one.png",
        "https://example.com/two.png",
      ];
      const second = [
        "https://example.com/three.png",
        "https://example.com/four.png",
        "https://example.com/five.png",
      ];
      const responses = await Promise.all([
        write(`/admin/products/${product.id}`, "PATCH", { imageUrls: first }),
        write(`/admin/products/${product.id}`, "PATCH", { imageUrls: second }),
        write(`/admin/products/${product.id}`, "PATCH", { price: 777 }),
      ]);
      responses.forEach((response) => assert.equal(response.status, 200));
      const actual = await get(product.id);
      assert.ok(
        [JSON.stringify(first), JSON.stringify(second)].includes(
          JSON.stringify(actual.imageUrls),
        ),
      );
      assert.equal(actual.imageUrl, actual.imageUrls[0]);
      assert.equal(actual.price, 777);
      assert.deepEqual(
        await rows(product.id),
        actual.imageUrls.map((url, position) => ({ position, url })),
      );
    });

    it("keeps administrator galleries when the seed runs again", async () => {
      await seed();
      const id = (
        await pool.query(
          "SELECT id FROM products WHERE name = 'AMD Ryzen 5 7600'",
        )
      ).rows[0].id;
      const original = await get(id, true);
      try {
        assert.equal(
          (await write(`/admin/products/${id}`, "PATCH", { imageUrls: urls }))
            .status,
          200,
        );
        await seed();
        await seed();
        assert.deepEqual((await get(id)).imageUrls, urls);
        assert.equal(
          (
            await pool.query("SELECT image_url FROM products WHERE id = $1", [
              id,
            ])
          ).rows[0].image_url,
          urls[0],
        );
      } finally {
        assert.equal(
          (
            await write(`/admin/products/${id}`, "PATCH", {
              imageUrls: original.imageUrls,
            })
          ).status,
          200,
        );
      }
    });

    it("hides inactive galleries and deletes image rows with their product", async () => {
      const hidden = await create("Oculto", { isActive: false });
      assert.equal(
        (await fetch(`${baseUrl}/api/v1/products/${hidden.id}`)).status,
        404,
      );
      assert.deepEqual((await get(hidden.id, true)).imageUrls, urls);
      assert.equal(
        (
          await write(`/admin/products/${hidden.id}`, "PATCH", {
            isActive: true,
            isFeatured: true,
          })
        ).status,
        200,
      );
      assert.deepEqual((await get(hidden.id)).imageUrls, urls);
      const featured = await fetch(
        `${baseUrl}/api/v1/products?isFeatured=true&categoryId=${categoryId}&limit=100`,
      );
      assert.ok(
        (await featured.json()).data.some(
          (item) => item.id === hidden.id && item.imageUrls.length === 3,
        ),
      );
      assert.equal(
        (await write(`/admin/products/${hidden.id}`, "DELETE")).status,
        204,
      );
      assert.deepEqual(await rows(hidden.id), []);
      assert.equal(
        (
          await write(`/admin/products/${hidden.id}`, "PATCH", {
            imageUrls: urls,
          })
        ).status,
        404,
      );
    });
  },
);
