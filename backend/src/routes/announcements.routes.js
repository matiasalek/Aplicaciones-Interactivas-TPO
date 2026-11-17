const express = require("express");
const {
  createAnnouncementsController,
} = require("../controllers/announcements.controller");
const { validate } = require("../middlewares/validate.middleware");
const {
  createAnnouncementsRepository,
} = require("../repositories/announcements.repository");
const {
  announcementIdSchema,
  announcementSchema,
} = require("../validators/announcement.schemas");

function createAnnouncementsRouters({ database, authenticate }) {
  const repository = createAnnouncementsRepository(database);
  const controller = createAnnouncementsController(repository);
  const announcementsRouter = express.Router();
  const adminAnnouncementsRouter = express.Router();

  announcementsRouter.get("/", controller.listPublic);
  adminAnnouncementsRouter.use(authenticate);
  adminAnnouncementsRouter.get("/", controller.listAdmin);
  adminAnnouncementsRouter.get("/products", controller.listProductOptions);
  adminAnnouncementsRouter.post(
    "/",
    validate({ body: announcementSchema }),
    controller.create,
  );
  adminAnnouncementsRouter.get(
    "/:id",
    validate({ params: announcementIdSchema }),
    controller.get,
  );
  adminAnnouncementsRouter.put(
    "/:id",
    validate({ params: announcementIdSchema, body: announcementSchema }),
    controller.update,
  );
  adminAnnouncementsRouter.delete(
    "/:id",
    validate({ params: announcementIdSchema }),
    controller.remove,
  );

  return { announcementsRouter, adminAnnouncementsRouter };
}

module.exports = { createAnnouncementsRouters };
