const { AppError } = require("../errors/app-error");

function announcementNotFound() {
  return new AppError(404, "ANNOUNCEMENT_NOT_FOUND", "Announcement not found");
}

function createAnnouncementsController(repository) {
  return {
    async listPublic(_request, response) {
      const data = await repository.findAll({ publicOnly: true });
      return response.json({ data });
    },
    async listAdmin(_request, response) {
      const data = await repository.findAll({ publicOnly: false });
      return response.json({ data });
    },
    async listProductOptions(_request, response) {
      const data = await repository.productOptions();
      return response.json({ data });
    },
    async get(request, response) {
      const data = await repository.findById(request.validated.params.id);
      if (!data) throw announcementNotFound();
      return response.json({ data });
    },
    async create(request, response) {
      const data = await repository.create(request.validated.body);
      response.location(`/api/v1/admin/announcements/${data.id}`);
      return response.status(201).json({ data });
    },
    async update(request, response) {
      const { params, body } = request.validated;
      const data = await repository.update(params.id, body);
      if (!data) throw announcementNotFound();
      return response.json({ data });
    },
    async remove(request, response) {
      if (!(await repository.remove(request.validated.params.id)))
        throw announcementNotFound();
      return response.status(204).send();
    },
  };
}

module.exports = { createAnnouncementsController };
