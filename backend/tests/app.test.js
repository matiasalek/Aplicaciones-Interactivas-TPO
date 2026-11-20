const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, describe, it } = require("node:test");

const { createApp } = require("../src/app");
const { config } = require("../src/config/env");

describe("HTTP API", () => {
  let baseUrl;
  let server;
  const allowedOrigin = "http://127.0.0.1:5173";
  const database = {
    checkConnection: async () => ({ database_time: new Date() }),
  };

  before(async () => {
    server = createApp({ database, corsOrigins: [allowedOrigin] }).listen(
      0,
      "127.0.0.1",
    );
    await once(server, "listening");

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("keeps the API available with administrator registration disabled", async (t) => {
    const disabledServer = createApp({
      database,
      authConfig: { ...config.auth, adminInviteCode: null },
    }).listen(0, "127.0.0.1");
    t.after(() => new Promise((resolve) => disabledServer.close(resolve)));
    await once(disabledServer, "listening");
    const url = `http://127.0.0.1:${disabledServer.address().port}/api/v1`;

    assert.equal((await fetch(`${url}/health`)).status, 200);
    const response = await fetch(`${url}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Ana",
        lastName: "Prueba",
        email: "ana@example.com",
        phone: "1144445555",
        password: "StrongPass123!",
        inviteCode: "a-code",
      }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "REGISTRATION_DISABLED");
  });

  it("returns the API health status", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^application\/json/);
    assert.deepEqual(await response.json(), { status: "ok" });
  });

  it("exposes API responses only to configured browser origins", async () => {
    const allowed = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Origin: allowedOrigin },
    });
    const other = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Origin: "http://localhost:5173" },
    });

    assert.equal(allowed.status, 200);
    assert.equal(
      allowed.headers.get("access-control-allow-origin"),
      allowedOrigin,
    );
    assert.match(allowed.headers.get("vary"), /\bOrigin\b/i);
    assert.equal(other.status, 200);
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  });

  it("handles preflight before authentication and preserves JWT validation", async () => {
    const url = `${baseUrl}/api/v1/profile`;
    const preflight = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });

    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-origin"),
      allowedOrigin,
    );
    assert.match(
      preflight.headers.get("access-control-allow-methods"),
      /\bPATCH\b/,
    );
    assert.deepEqual(
      preflight.headers
        .get("access-control-allow-headers")
        .toLowerCase()
        .split(",")
        .map((header) => header.trim()),
      ["authorization", "content-type"],
    );

    const denied = await fetch(url, { headers: { Origin: allowedOrigin } });

    assert.equal(denied.status, 401);
    assert.equal(
      denied.headers.get("access-control-allow-origin"),
      allowedOrigin,
    );
  });

  it("returns the API readiness status", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ready",
      database: "connected",
    });
  });

  it("returns 503 when the database is unavailable", async () => {
    const unavailableServer = createApp({
      database: {
        checkConnection: async () => {
          throw new Error("database unavailable");
        },
      },
    }).listen(0, "127.0.0.1");
    await once(unavailableServer, "listening");

    try {
      const address = unavailableServer.address();
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/health/ready`,
      );

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        status: "unavailable",
        database: "disconnected",
      });
    } finally {
      await new Promise((resolve, reject) => {
        unavailableServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });

  it("returns a JSON 404 response for an unknown route", async () => {
    const response = await fetch(`${baseUrl}/api/v1/unknown`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: {
        code: "NOT_FOUND",
        message: "Route GET /api/v1/unknown not found",
      },
    });
  });

  it("returns a JSON 400 response for an invalid JSON body", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: "INVALID_JSON",
        message: "Request body contains invalid JSON",
      },
    });
  });
});
