const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, describe, it } = require("node:test");

const { createApp } = require("../src/app");
const { authConfig, inviteCode } = require("./fixtures/auth");
const { createPool } = require("../src/db/database");
const { migrate } = require("../src/db/migrate");

const connectionString = process.env.TEST_DATABASE_URL;

describe("authentication API integration", { skip: !connectionString }, () => {
  let baseUrl;
  let pool;
  let server;

  before(async () => {
    const databaseConfig = { connectionString, max: 5, ssl: false };
    await migrate();
    pool = createPool(databaseConfig);
    await pool.query("TRUNCATE TABLE administrators RESTART IDENTITY CASCADE");

    const database = {
      checkConnection: () => pool.query("SELECT 1"),
      query: (text, values) => pool.query(text, values),
    };
    server = createApp({ database, authConfig }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
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
  });

  it("rejects missing or invalid invitations without creating an administrator", async () => {
    const registration = {
      firstName: "Ana",
      lastName: "Prueba",
      email: "invitacion-invalida@example.com",
      phone: "1144445555",
      password: "StrongPass123!",
    };
    const url = `${baseUrl}/api/v1/auth/register`;
    const options = {
      method: "POST",
      headers: { "content-type": "application/json" },
    };
    const missing = await fetch(url, {
      ...options,
      body: JSON.stringify(registration),
    });
    assert.equal(missing.status, 400);
    const { error } = await missing.json();
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.ok(error.details.some((detail) => detail.field === "inviteCode"));

    const invalid = await fetch(url, {
      ...options,
      body: JSON.stringify({ ...registration, inviteCode: "incorrect" }),
    });
    assert.equal(invalid.status, 403);
    assert.equal((await invalid.json()).error.code, "INVALID_INVITE_CODE");
    const result = await pool.query(
      "SELECT id FROM administrators WHERE email = $1",
      [registration.email],
    );
    assert.equal(result.rowCount, 0);
  });

  it("registers, authenticates, updates the profile, and logs out", async () => {
    const registration = {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+54 11 4444 5555",
      password: "StrongPass123!",
      inviteCode,
    };
    const registerResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(registration),
    });

    assert.equal(registerResponse.status, 201);
    const registered = (await registerResponse.json()).data;
    assert.ok(registered.token);
    assert.equal(registered.tokenType, "Bearer");
    assert.equal(registered.user.email, registration.email);
    assert.equal(registered.user.passwordHash, undefined);
    assert.equal(registered.user.inviteCode, undefined);

    const duplicateResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...registration, email: "ADA@example.com" }),
    });
    assert.equal(duplicateResponse.status, 409);

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: registration.email,
        password: registration.password,
      }),
    });
    assert.equal(loginResponse.status, 200);
    const login = (await loginResponse.json()).data;

    const profileResponse = await fetch(`${baseUrl}/api/v1/profile`, {
      headers: { authorization: `Bearer ${login.token}` },
    });
    assert.equal(profileResponse.status, 200);
    assert.equal((await profileResponse.json()).data.firstName, "Ada");

    const updateResponse = await fetch(`${baseUrl}/api/v1/profile`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${login.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ phone: "+54 11 9999 0000" }),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).data.phone, "+54 11 9999 0000");

    const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${login.token}` },
    });
    assert.equal(logoutResponse.status, 204);

    const revokedResponse = await fetch(`${baseUrl}/api/v1/profile`, {
      headers: { authorization: `Bearer ${login.token}` },
    });
    assert.equal(revokedResponse.status, 401);
  });

  it("resets a forgotten password and revokes existing sessions", async () => {
    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "ada@example.com",
        password: "StrongPass123!",
      }),
    });
    const oldSession = (await loginResponse.json()).data;

    const forgotResponse = await fetch(
      `${baseUrl}/api/v1/auth/forgot-password`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "ada@example.com" }),
      },
    );
    assert.equal(forgotResponse.status, 202);
    const resetToken = (await forgotResponse.json()).data.resetToken;
    assert.match(resetToken, /^[a-f0-9]{64}$/);

    const resetResponse = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: resetToken,
        password: "NewStrongPass456!",
      }),
    });
    assert.equal(resetResponse.status, 204);

    const revokedResponse = await fetch(`${baseUrl}/api/v1/profile`, {
      headers: { authorization: `Bearer ${oldSession.token}` },
    });
    assert.equal(revokedResponse.status, 401);

    const oldLoginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "ada@example.com",
        password: "StrongPass123!",
      }),
    });
    assert.equal(oldLoginResponse.status, 401);

    const newLoginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "ada@example.com",
        password: "NewStrongPass456!",
      }),
    });
    assert.equal(newLoginResponse.status, 200);
  });

  it("validates phones and UTF-8 passwords and normalizes email before authentication", async () => {
    const email = `validation-${Date.now()}@example.com`;
    const values = {
      firstName: "Ana",
      lastName: "Prueba",
      email,
      phone: "+54 (11) 4444-5555",
      password: "Segura123!",
      inviteCode,
    };
    for (const [field, value] of [
      ["phone", "abcde"],
      ["phone", "12-34"],
      ["phone", "-----"],
      ["email", "ana..p@example.com"],
      ["password", "é".repeat(37)],
      ["password", "😀".repeat(19)],
    ]) {
      const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, [field]: value }),
      });
      assert.equal(response.status, 400);
      assert.ok(
        (await response.json()).error.details.some(
          (detail) => detail.field === field,
        ),
      );
    }
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, email: ` ${email.toUpperCase()} ` }),
    });
    assert.equal(response.status, 201);
    const { data } = await response.json();
    try {
      assert.equal(data.user.email, email);
      const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: ` ${email.toUpperCase()} `,
          password: values.password,
        }),
      });
      assert.equal(login.status, 200);
      const invalidProfile = await fetch(`${baseUrl}/api/v1/profile`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({ phone: "abcde" }),
      });
      assert.equal(invalidProfile.status, 400);
      assert.equal(
        (
          await pool.query("SELECT phone FROM administrators WHERE id = $1", [
            data.user.id,
          ])
        ).rows[0].phone,
        values.phone,
      );
      const invalidReset = await fetch(
        `${baseUrl}/api/v1/auth/reset-password`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token: "a".repeat(64),
            password: "é".repeat(37),
          }),
        },
      );
      assert.equal(invalidReset.status, 400);
      assert.equal((await invalidReset.json()).error.code, "VALIDATION_ERROR");
    } finally {
      await pool.query("DELETE FROM administrators WHERE id = $1", [
        data.user.id,
      ]);
    }
  });

  it("protects administrator endpoints", async () => {
    const profileResponse = await fetch(`${baseUrl}/api/v1/profile`);
    assert.equal(profileResponse.status, 401);

    const categoryResponse = await fetch(`${baseUrl}/api/v1/categories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Unauthorized" }),
    });
    assert.equal(categoryResponse.status, 401);
  });
});
