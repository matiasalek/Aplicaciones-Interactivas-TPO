const assert = require("node:assert/strict");
const { once } = require("node:events");
const { test } = require("node:test");

const { createApp } = require("../src/app");
const database = require("../src/db/database");
const { migrate } = require("../src/db/migrate");

const connectionString = process.env.TEST_DATABASE_URL;

test(
  "publishes announcements and applies only the effective product price",
  { skip: !connectionString },
  async (t) => {
    await migrate();
    const pool = database.createPool({ connectionString, max: 5, ssl: false });
    const server = createApp({
      database: {
        query: (text, values) => pool.query(text, values),
        withTransaction: (callback) => database.withTransaction(callback, pool),
      },
    }).listen(0, "127.0.0.1");
    t.after(async () => {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
      await database.close();
    });
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}/api/v1`;
    const adminPath = "/admin/announcements";
    let token;
    async function call(path, { method = "GET", body, auth = false } = {}) {
      const headers = body ? { "Content-Type": "application/json" } : {};
      if (auth) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(base + path, {
        method,
        headers,
        body: JSON.stringify(body),
      });
      return {
        status: response.status,
        ...(response.status === 204 ? {} : await response.json()),
      };
    }
    const suffix = Date.now();
    const registration = await call("/auth/register", {
      method: "POST",
      body: {
        firstName: "Test",
        lastName: "Admin",
        email: `announcements-${suffix}@example.com`,
        phone: "+54 11 4444 5555",
        password: "StrongPass123!",
      },
    });
    assert.equal(registration.status, 201);
    token = registration.data.token;
    const category = await call("/categories", {
      auth: true,
      method: "POST",
      body: { name: `Announcements ${suffix}` },
    });
    assert.equal(category.status, 201);
    async function createProduct(name, price) {
      const result = await call("/admin/products", {
        auth: true,
        method: "POST",
        body: {
          name: `${name} ${suffix}`,
          categoryId: category.data.id,
          price,
          description: "Testing current price",
          imageUrl: "https://example.com/product.png",
        },
      });
      assert.equal(result.status, 201);
      return result.data.id;
    }
    const productId = await createProduct("Offer product", 200);
    const otherId = await createProduct("Regular product", 100);
    const productPath = `/products/${productId}`;
    const adminProductPath = `/admin${productPath}`;
    const offer = {
      type: "promotion",
      title: `Sale ${suffix}`,
      description: "Save on this product",
      productId,
      promotionPrice: 25.5,
    };
    const publish = { ...offer, isPublished: true };
    const write = (path, method, body) =>
      call(path, { method, body, auth: true });

    assert.equal((await call(adminPath)).status, 401);
    assert.equal(
      (await call(adminPath, { method: "POST", body: offer })).status,
      401,
    );
    assert.equal(
      (await write(adminPath, "POST", { ...offer, type: "news" })).status,
      400,
    );
    assert.equal(
      (await write(adminPath, "POST", { ...offer, promotionPrice: 25.501 }))
        .status,
      400,
    );
    const invalid = await write(adminPath, "POST", {
      ...offer,
      promotionPrice: 200,
    });
    assert.equal(invalid.error.code, "INVALID_PROMOTION_PRICE");

    const draft = await write(adminPath, "POST", offer);
    assert.equal(draft.status, 201);
    const offerPath = `${adminPath}/${draft.data.id}`;
    assert.equal(draft.data.isPublished, false);
    assert.equal(
      (await call("/announcements")).data.some(
        ({ id }) => id === draft.data.id,
      ),
      false,
    );
    assert.equal((await call(productPath)).data.effectivePrice, 200);
    assert.equal((await call(productPath)).data.isFeatured, false);
    assert.equal(
      (await write(`/admin/products/${otherId}`, "PATCH", { isFeatured: true }))
        .status,
      200,
    );

    const concurrent = await Promise.all([
      write(offerPath, "PUT", publish),
      write(adminPath, "POST", { ...publish, title: `Other sale ${suffix}` }),
    ]);
    const conflict = concurrent.find(({ status }) => status === 409);
    assert.equal(conflict?.error.code, "PRODUCT_PROMOTION_CONFLICT");
    const published = concurrent.find(({ status }) => status < 300).data;
    const publishedPath = `${adminPath}/${published.id}`;
    assert.equal(
      (await call("/announcements")).data.some(({ id }) => id === published.id),
      true,
    );
    const { price, effectivePrice, promotionPrice } = (await call(productPath))
      .data;
    assert.deepEqual(
      { price, effectivePrice, promotionPrice },
      {
        price: 200,
        effectivePrice: 25.5,
        promotionPrice: 25.5,
      },
    );
    const query = `categoryId=${category.data.id}`;
    assert.equal((await call(productPath)).data.isFeatured, true);
    const selection = await call(
      `/products?${query}&isFeatured=true&sort=offers_first&limit=1`,
    );
    assert.equal(selection.meta.total, 2);
    assert.deepEqual(
      selection.data.map(({ id }) => id),
      [productId],
    );
    const admin = await call(adminProductPath, { auth: true });
    assert.equal(admin.data.effectivePrice, 25.5);
    assert.equal(admin.data.isFeatured, false);
    const ordered = (await call(`/products?${query}&sort=price_asc`)).data;
    assert.deepEqual(
      ordered.map(({ id }) => id),
      [productId, otherId],
    );
    const filtered = await call(
      `/products?${query}&minPrice=25.50&maxPrice=25.50`,
    );
    assert.deepEqual(
      filtered.data.map(({ id }) => id),
      [productId],
    );
    const basePriceEdit = await write(adminProductPath, "PATCH", { price: 25 });
    assert.equal(basePriceEdit.error.code, "REGULAR_PRICE_CONFLICT");

    assert.equal(
      (await write(adminProductPath, "PATCH", { isActive: false })).status,
      200,
    );
    assert.equal((await call(productPath)).status, 404);
    const visibleFeatured = await call(`/products?${query}&isFeatured=true`);
    assert.deepEqual(
      visibleFeatured.data.map(({ id }) => id),
      [otherId],
    );
    assert.equal(
      (await call("/announcements")).data.some(({ id }) => id === published.id),
      false,
    );
    assert.equal(
      (await write(adminProductPath, "PATCH", { isActive: true })).status,
      200,
    );
    assert.equal((await call(productPath)).data.effectivePrice, 25.5);

    assert.equal((await write(publishedPath, "PUT", offer)).status, 200);
    assert.equal((await call(productPath)).data.effectivePrice, 200);
    assert.equal((await call(productPath)).data.isFeatured, false);
    const withoutManualSelection = await call(
      `/products?${query}&isFeatured=false`,
    );
    assert.deepEqual(
      withoutManualSelection.data.map(({ id }) => id),
      [productId],
    );
    assert.equal(
      (await write(adminProductPath, "PATCH", { isFeatured: true })).status,
      200,
    );
    assert.equal((await write(publishedPath, "PUT", publish)).status, 200);
    assert.equal((await write(publishedPath, "DELETE")).status, 204);
    assert.equal((await call(productPath)).data.effectivePrice, 200);
    assert.equal((await call(productPath)).data.isFeatured, true);
    assert.equal((await write(adminProductPath, "DELETE")).status, 204);
    assert.equal((await call(offerPath, { auth: true })).status, 404);

    const news = await write(adminPath, "POST", {
      type: "news",
      title: `News ${suffix}`,
      description: "New opening hours",
      isPublished: true,
    });
    assert.equal(news.status, 201);
    assert.equal(
      (await call("/announcements")).data.some(({ id }) => id === news.data.id),
      true,
    );
    assert.equal(
      (await write(`${adminPath}/${news.data.id}`, "DELETE")).status,
      204,
    );
  },
);
