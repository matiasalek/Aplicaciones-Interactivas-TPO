# Aplicaciones Interactivas - TPO

API REST para una plataforma promocional de componentes para videojuegos, desarrollada como Trabajo Práctico Obligatorio de Aplicaciones Interactivas.

La [consigna del TPO](./TPO%20Segundo%20Cuatrimestre%202026.pdf) es la fuente de verdad. Este repositorio implementa únicamente el servidor; no incluye interfaz web, carrito, pagos ni envíos.

## Estado

El alcance obligatorio del servidor está implementado:

- API REST con Node.js y Express.
- PostgreSQL mediante `pg`, sin ORM.
- Migraciones SQL y carga inicial idempotente.
- Registro, inicio y cierre de sesión.
- Recuperación de contraseña y perfil del administrador.
- Autenticación y autorización mediante JWT con sesiones revocables.
- Información institucional pública y administrable.
- CRUD de categorías.
- Catálogo y CRUD de productos.
- Activación, desactivación y disponibilidad de productos.
- Productos destacados administrables y filtro público de destacados.
- Galerías de una a diez imágenes mediante URLs, con orden e imagen principal.
- Promociones y novedades administrables. Las ofertas publicadas definen el precio vigente del catálogo.
- Búsqueda, filtro por categoría, orden y paginación.
- Formulario público y gestión administrativa de consultas.
- 20 productos precargados.
- Fotografías de los 20 modelos de ejemplo, optimizadas en WebP y servidas localmente.
- Validaciones y respuestas de error JSON.
- Pruebas automatizadas e integración real con PostgreSQL.

No quedan funcionalidades obligatorias del backend pendientes de implementación dentro del alcance acordado para este TP. La interfaz web está implementada en el repositorio independiente [Frontend](https://github.com/matiasalek/Aplicaciones-Interactivas-TPO-Frontend).

## Tecnologías

- JavaScript con módulos CommonJS.
- Node.js 24.20.0 y npm 11.
- Express 5.2.1.
- PostgreSQL 17.
- `pg` sin ORM.
- Zod para validación.
- `bcryptjs` para contraseñas.
- Tokens JWT para autenticación.
- `node:test` para pruebas.

## Inicio rápido con PostgreSQL local

Requisitos:

- Node.js 24.20.0, preferentemente mediante `fnm`.
- PostgreSQL 17 instalado mediante Homebrew.
- Postman para las pruebas manuales.

Instalar las herramientas en macOS, si todavía no están disponibles:

```bash
brew install postgresql@17
brew install --cask postman
```

Iniciar PostgreSQL:

```bash
brew services start postgresql@17
```

Crear la base la primera vez:

```bash
createdb gamer_store
```

Desde la raíz del repositorio, seleccionar la versión de Node.js:

```bash
fnm install
fnm use
```

Desde el directorio `backend/`:

```bash
npm ci
cp .env.example .env
npm run db:setup
npm run dev
```

La API queda disponible en `http://localhost:3000`. Comprobarla con:

```bash
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health/ready
```

Para detener PostgreSQL:

```bash
brew services stop postgresql@17
```

Detener el servicio no elimina la base ni sus datos. Docker no es necesario para ejecutar el proyecto.

## Variables de entorno

| Variable | Descripción | Valor de desarrollo |
| --- | --- | --- |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `PORT` | Puerto HTTP | `3000` |
| `DATABASE_URL` | URL de PostgreSQL | `postgresql://localhost:5432/gamer_store` |
| `DATABASE_SSL` | Habilita TLS para PostgreSQL | `false` |
| `DATABASE_POOL_MAX` | Máximo de conexiones | `10` |
| `JWT_SECRET` | Firma de tokens; mínimo 32 caracteres | Cambiar antes de producción |
| `JWT_EXPIRES_SECONDS` | Duración de sesión | `28800` |
| `PASSWORD_RESET_EXPIRES_MINUTES` | Duración del token de recuperación | `30` |
| `BCRYPT_ROUNDS` | Costo del resumen criptográfico de contraseña | `10` |

En producción, `JWT_SECRET` es obligatorio. El archivo `.env` está excluido de Git.

## Rutas de la API

Las rutas marcadas como **Administrador** requieren:

```http
Authorization: Bearer <token>
```

### Salud

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | Público | Estado del proceso HTTP. |
| `GET` | `/api/v1/health/ready` | Público | Estado de PostgreSQL. |

### Autenticación y perfil

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Público | Registra un administrador e inicia sesión. |
| `POST` | `/api/v1/auth/login` | Público | Inicia sesión. |
| `POST` | `/api/v1/auth/logout` | Administrador | Revoca la sesión actual. |
| `POST` | `/api/v1/auth/forgot-password` | Público | Genera un token de recuperación. |
| `POST` | `/api/v1/auth/reset-password` | Público | Cambia la contraseña y revoca sesiones previas. |
| `GET` | `/api/v1/profile` | Administrador | Obtiene el perfil. |
| `PATCH` | `/api/v1/profile` | Administrador | Modifica nombre, apellido, correo o teléfono. |

En desarrollo y pruebas, `forgot-password` devuelve `resetToken` para poder probar el flujo completo con Postman, sin enviar un correo real. Esta es la modalidad acordada para el TP y no queda pendiente integrar un proveedor de correo. En producción el token no se expone en la respuesta.

### Información institucional

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/v1/store` | Público | Consulta los datos del comercio. |
| `PUT` | `/api/v1/store` | Administrador | Crea o reemplaza los datos del comercio. |

### Categorías

| Método | Ruta | Acceso |
| --- | --- | --- |
| `GET` | `/api/v1/categories` | Público |
| `GET` | `/api/v1/categories/:id` | Público |
| `POST` | `/api/v1/categories` | Administrador |
| `PATCH` | `/api/v1/categories/:id` | Administrador |
| `DELETE` | `/api/v1/categories/:id` | Administrador |

Una categoría con productos asociados no puede eliminarse.

### Productos públicos

| Método | Ruta | Acceso |
| --- | --- | --- |
| `GET` | `/api/v1/products` | Público |
| `GET` | `/api/v1/products/:id` | Público |

Parámetros del listado:

| Parámetro | Valores |
| --- | --- |
| `q` | Texto de búsqueda. |
| `categoryId` | Identificador positivo. |
| `availability` | `in_stock`, `out_of_stock`, `preorder`. |
| `isFeatured` | `true` para productos destacados manualmente o con oferta publicada, `false` para los demás. |
| `minPrice` | Precio mínimo inclusivo, opcional y no negativo, con hasta dos decimales. |
| `maxPrice` | Precio máximo inclusivo, opcional y no negativo, con hasta dos decimales. |
| `sort` | `newest`, `offers_first`, `name`, `price_asc`, `price_desc`. |
| `page` | Página, desde 1. |
| `limit` | Entre 1 y 100. |

Las rutas públicas nunca devuelven productos desactivados.

Los filtros de precio aceptan importes decimales con punto entre 0 y 9999999999.99. Se puede enviar uno o ambos. Si se envían ambos, `minPrice` no debe superar a `maxPrice`. Ejemplo `/api/v1/products?minPrice=100000&maxPrice=300000&sort=price_asc`. Los filtros y el orden usan el precio vigente, con la oferta aplicada cuando corresponda. Los totales corresponden a los resultados filtrados antes de paginar. Los formatos o rangos inválidos responden `400 VALIDATION_ERROR`.

### Administración de productos

| Método | Ruta | Acceso |
| --- | --- | --- |
| `GET` | `/api/v1/admin/products` | Administrador |
| `GET` | `/api/v1/admin/products/:id` | Administrador |
| `POST` | `/api/v1/admin/products` | Administrador |
| `PATCH` | `/api/v1/admin/products/:id` | Administrador |
| `DELETE` | `/api/v1/admin/products/:id` | Administrador |

El listado administrativo acepta los filtros de productos y `isActive=true|false`. Su filtro `isFeatured` usa la selección manual.

### Productos destacados

Cada producto incluye `isFeatured` en listados y detalles. En administración representa la selección manual. Al crear, el campo es opcional y vale `false` por defecto. Un administrador autenticado puede modificarlo con un booleano JSON:

```http
PATCH /api/v1/admin/products/:id
Authorization: Bearer <token>
Content-Type: application/json

{"isFeatured": true}
```

`GET /api/v1/products?isFeatured=true` incluye los productos activos marcados manualmente y los que tienen una oferta publicada. El campo público `isFeatured` refleja esa misma regla. Inicio pide `sort=offers_first` para priorizar las ofertas por fecha de actualización y completar los espacios restantes con los destacados manuales más recientes. Al retirar la oferta, se aplica la selección manual. Las rutas públicas solo muestran productos activos.

Para actualizar una instalación existente, detener la API, ejecutar `npm run db:migrate` desde `backend/` y reiniciarla. La migración `006_add_featured_products.sql` agrega el campo sin borrar datos; los productos existentes quedan sin destacar. La carga inicial mantiene las selecciones administradas al ejecutarse nuevamente.

### Galerías de imágenes

Listados y detalles incluyen `imageUrls`, un arreglo ordenado de una a diez URLs, y mantienen `imageUrl` como primera imagen por compatibilidad. Para crear o reemplazar una galería se envía `imageUrls`; la primera entrada es la principal:

```http
PATCH /api/v1/admin/products/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "imageUrls": [
    "https://example.com/frente.png",
    "https://example.com/parte-posterior.png"
  ]
}
```

Cada referencia debe ser una URL HTTP/HTTPS completa o una ruta WebP propia del catálogo. Se admiten hasta 2000 caracteres. Se recortan espacios exteriores y se rechazan referencias repetidas tras normalizarlas, galerías vacías o con más de diez imágenes y solicitudes que mezclen `imageUrl` e `imageUrls`. El orden del arreglo define el orden de la galería. Quitar entradas elimina sus referencias del producto.

El contrato anterior sigue funcionando: crear con `imageUrl` genera una galería de una imagen; editar con `imageUrl` reemplaza solamente la principal y conserva las secundarias, sin duplicar la nueva principal si ya estaba entre ellas. Editar otros campos conserva toda la galería. Las escrituras del producto y sus imágenes son transaccionales; se bloquea la fila al editar para impedir colecciones mezcladas ante solicitudes simultáneas.

La migración `007_create_product_images.sql` copia la imagen anterior de cada producto a la posición inicial sin modificar sus otros datos. Detener la API, ejecutar `npm run db:migrate` y reiniciarla. No recrear la base. El seed crea una imagen para los productos nuevos y respeta galerías administradas al repetirse. Eliminar un producto elimina sus imágenes en cascada.

La galería acepta direcciones HTTP/HTTPS y rutas propias bajo `/api/v1/media/products/` con nombre de archivo WebP. Las fotos de la carga inicial se sirven desde `backend/public/catalog-media/`. El [archivo de créditos](backend/public/catalog-media/credits.json) indica las fuentes, autores, licencias y adaptaciones.

La migración `009_add_catalog_photos.sql` reemplaza las imágenes de ejemplo intactas y actualiza algunos nombres para que coincidan con su foto. Conserva galerías editadas. Un cambio de modelo se aplica a ejemplos con descripción original y sin promociones vinculadas. La migración preserva los identificadores, precios, estados y categorías.

La API guarda referencias de imagen. Los archivos del catálogo se incluyen con el proyecto. La verificación de galerías está en [backend/docs/VERIFICACION_GALERIAS.md](backend/docs/VERIFICACION_GALERIAS.md).

### Promociones y novedades

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/v1/announcements` | Público | Lista publicaciones visibles, de la más reciente a la más antigua. |
| `GET` | `/api/v1/admin/announcements` | Administrador | Lista publicaciones y borradores. |
| `GET` | `/api/v1/admin/announcements/products` | Administrador | Lista las opciones de producto y sus precios habituales. |
| `POST` | `/api/v1/admin/announcements` | Administrador | Crea una publicación. |
| `GET` | `/api/v1/admin/announcements/:id` | Administrador | Obtiene una publicación. |
| `PUT` | `/api/v1/admin/announcements/:id` | Administrador | Guarda la publicación completa y su estado. |
| `DELETE` | `/api/v1/admin/announcements/:id` | Administrador | Elimina una publicación. |

El cuerpo de alta y edición incluye `type` (`promotion` o `news`), `title` (hasta 120 caracteres), `description` (hasta 2000), `isPublished` (por defecto `false`), `productId` y `promotionPrice`. Solo las promociones admiten un producto y un precio en conjunto. El precio promocional debe ser menor que el habitual. Si el producto ya tiene una promoción publicada se devuelve `409 PRODUCT_PROMOTION_CONFLICT`.

La API de productos devuelve `price` como precio habitual, `promotionPrice` como el importe de oferta o `null` y `effectivePrice` como precio vigente. Para reducir el precio habitual hasta el importe de una oferta publicada o por debajo, primero hay que editar la oferta o volverla a borrador. Una promoción vinculada desaparece de Inicio mientras el producto esté inactivo. Eliminar un producto también elimina sus promociones vinculadas.

Aplicá `npm run db:migrate` para incorporar la migración `008_create_announcements.sql` a una instalación existente.

### Consultas

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `POST` | `/api/v1/inquiries` | Público | Envía una consulta. |
| `GET` | `/api/v1/inquiries` | Administrador | Lista consultas. |
| `GET` | `/api/v1/inquiries/:id` | Administrador | Obtiene una consulta. |
| `PATCH` | `/api/v1/inquiries/:id/status` | Administrador | Cambia su estado. |
| `DELETE` | `/api/v1/inquiries/:id` | Administrador | Elimina una consulta. |

El listado acepta `status`, `page` y `limit`. Los estados son `pending`, `read` y `answered`.

## Validaciones

El contrato detallado está en [backend/docs/VALIDACIONES.md](backend/docs/VALIDACIONES.md). La API valida todos los formularios independientemente del frontend. Precio y categoría deben ser números JSON; se rechazan nulos, booleanos y cadenas. El precio admite hasta dos decimales sin redondeo de entradas inválidas. Los identificadores respetan el rango integer de PostgreSQL.

Imágenes y redes requieren URLs completas HTTP/HTTPS de hasta 2000 caracteres. Los correos se validan después de quitar espacios exteriores y se normalizan a minúsculas. Los teléfonos requieren al menos cinco dígitos, hasta 50 caracteres y permiten separadores habituales y `+` al inicio, sin imponer un país.

Registro y restablecimiento rechazan contraseñas que excedan 72 bytes UTF-8 además del rango de 8 a 72 caracteres, evitando truncamiento. La validación del inicio de sesión conserva la compatibilidad con credenciales existentes. No se agregan dependencias ni migraciones por estas correcciones.

## Base de datos

Preparar esquema y datos:

```bash
npm run db:setup
```

Los comandos también pueden ejecutarse por separado:

```bash
npm run db:migrate
npm run db:seed
```

Las migraciones se encuentran en `backend/src/db/migrations/`. La carga inicial puede ejecutarse varias veces sin duplicar categorías ni productos.

El modelo completo y las consultas de inspección están en [backend/docs/BASE_DE_DATOS.md](backend/docs/BASE_DE_DATOS.md).

## Pruebas con Postman

La guía paso a paso y las consultas SQL para verificar cada cambio están en [backend/docs/PRUEBAS_CON_POSTMAN.md](backend/docs/PRUEBAS_CON_POSTMAN.md).

También se incluye una colección importable:

```text
backend/postman/API de Componentes para Videojuegos.postman_collection.json
```

## Pruebas automatizadas

Conjunto de pruebas rápidas, sin depender de PostgreSQL:

```bash
npm test
```

Las pruebas de integración eliminan datos de sus tablas. Usar exclusivamente una base de pruebas:

```bash
createdb gamer_store_test
TEST_DATABASE_URL=postgresql://localhost:5432/gamer_store_test \
DATABASE_URL=postgresql://localhost:5432/gamer_store_test \
NODE_ENV=test \
npm run test:integration
```

Los resultados y las comprobaciones de actualización del extra de productos destacados están en [backend/docs/VERIFICACION_DESTACADOS.md](backend/docs/VERIFICACION_DESTACADOS.md).

## Comandos disponibles

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia la API. |
| `npm run dev` | Inicia con reinicio automático. |
| `npm run db:check` | Comprueba PostgreSQL. |
| `npm run db:migrate` | Aplica migraciones pendientes. |
| `npm run db:seed` | Carga seis categorías y 20 productos. |
| `npm run db:setup` | Ejecuta las migraciones y la carga inicial. |
| `npm test` | Ejecuta pruebas rápidas. |
| `npm run test:integration` | Ejecuta pruebas reales contra PostgreSQL. |
| `npm run test:watch` | Ejecuta pruebas en modo observación. |

## Decisiones de alcance

- Una publicación guarda de una a diez URLs de imágenes ordenadas; la primera es la principal. Se mantiene el campo anterior `imageUrl` por compatibilidad. No se suben archivos.
- El envío real de correos queda fuera del alcance acordado para este TP. La recuperación de contraseña está implementada y se prueba con el token devuelto en desarrollo y pruebas.
- La interfaz web se mantiene en un repositorio independiente; este repositorio contiene el servidor.
- No se implementaron carrito, pagos ni envíos porque no forman parte de la consigna.
