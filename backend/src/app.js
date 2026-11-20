const cors = require("cors");
const express = require("express");
const path = require("node:path");

const { config } = require("./config/env");
const database = require("./db/database");
const { createAuthenticate } = require("./middlewares/auth.middleware");
const { createAnnouncementsRouters } = require("./routes/announcements.routes");
const { createAuthRouters } = require("./routes/auth.routes");
const { createCategoriesRouter } = require("./routes/categories.routes");
const { createHealthRouter } = require("./routes/health.routes");
const { createInquiriesRouter } = require("./routes/inquiries.routes");
const {
  createAdminProductsRouter,
  createProductsRouter,
} = require("./routes/products.routes");
const { createStoreRouter } = require("./routes/store.routes");
const { errorHandler } = require("./middlewares/error.middleware");
const { notFoundHandler } = require("./middlewares/not-found.middleware");
const { catalogImageBase } = require("./product-images");

function createApp(dependencies = {}) {
  const app = express();
  const appDatabase = dependencies.database || database;
  const authenticate = createAuthenticate({
    database: appDatabase,
    authConfig: config.auth,
  });
  const { authRouter, profileRouter } = createAuthRouters({
    database: appDatabase,
    authenticate,
    authConfig: config.auth,
    nodeEnv: config.nodeEnv,
  });
  const { announcementsRouter, adminAnnouncementsRouter } =
    createAnnouncementsRouters({ database: appDatabase, authenticate });

  app.disable("x-powered-by");
  const corsOrigins = dependencies.corsOrigins ?? config.corsOrigins;
  if (corsOrigins.length > 0) {
    app.use(
      "/api/v1",
      cors({
        origin: corsOrigins,
        allowedHeaders: ["Authorization", "Content-Type"],
      }),
    );
  }
  app.use(express.json({ limit: "1mb" }));
  app.use(
    catalogImageBase,
    express.static(path.join(__dirname, "../public/catalog-media"), {
      index: false,
      redirect: false,
    }),
  );

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/profile", profileRouter);
  app.use("/api/v1/announcements", announcementsRouter);
  app.use("/api/v1/admin/announcements", adminAnnouncementsRouter);
  app.use(
    "/api/v1/health",
    createHealthRouter({ database: appDatabase }),
  );
  app.use(
    "/api/v1/categories",
    createCategoriesRouter({ database: appDatabase, authenticate }),
  );
  app.use(
    "/api/v1/store",
    createStoreRouter({ database: appDatabase, authenticate }),
  );
  app.use(
    "/api/v1/inquiries",
    createInquiriesRouter({ database: appDatabase, authenticate }),
  );
  app.use(
    "/api/v1/products",
    createProductsRouter({ database: appDatabase }),
  );
  app.use(
    "/api/v1/admin/products",
    createAdminProductsRouter({
      database: appDatabase,
      authenticate,
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
