const catalogImageBase = "/api/v1/media/products";
const catalogImagePattern =
  /^\/api\/v1\/media\/products\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/;

function imageReferenceKey(value) {
  return catalogImagePattern.test(value) ? value : new URL(value).href;
}

module.exports = { catalogImageBase, catalogImagePattern, imageReferenceKey };
