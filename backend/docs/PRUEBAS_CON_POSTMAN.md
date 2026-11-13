# Guía de pruebas manuales con Postman

## Preparación

1. Iniciar PostgreSQL y preparar la base:

   ```bash
   brew services start postgresql@17
   createdb gamer_store # solamente la primera vez
   cd backend
   npm ci
   cp .env.example .env
   npm run db:setup
   npm run dev
   ```

2. Importar `postman/API de Componentes para Videojuegos.postman_collection.json` en Postman.
3. Confirmar que la variable de colección `baseUrl` tenga el valor `http://localhost:3000`.
4. Ejecutar las solicitudes en el orden indicado. La colección guarda automáticamente `token`, `categoryId`, `productId`, `inquiryId` y `resetToken` cuando corresponde.

No ejecutar toda la colección automáticamente en el primer recorrido: las solicitudes de recuperación, cierre de sesión y eliminación invalidan datos que usan las demás. Probarlas manualmente siguiendo este flujo.

## Flujo recomendado

### 1. Salud

- `Salud / Estado general` debe responder `200` con `{ "status": "ok" }`.
- `Salud / Disponibilidad` debe responder `200` e indicar `database: "connected"`.

### 2. Administrador

- Ejecutar `Autenticación / Registrar administrador` una sola vez. Guarda el token JWT.
- Ejecutar `Autenticación / Consultar perfil`.
- Ejecutar `Autenticación / Modificar perfil` y comprobar el nuevo teléfono.
- Volver a registrar el mismo correo debe responder `409 EMAIL_CONFLICT`.

Comprobar la base:

```sql
SELECT id, first_name, last_name, email, phone
FROM administrators;
```

### 3. Información institucional

- Ejecutar `Comercio / Crear o reemplazar información institucional`.
- Ejecutar `Comercio / Consultar información institucional` sin autenticación.

Comprobar:

```sql
SELECT name, address, phone, social_links, opening_hours
FROM store_information;
```

### 4. Categoría

- Ejecutar `Categorías / Crear categoría`. Guarda `categoryId`.
- Ejecutar `Categorías / Consultar categoría`.
- Ejecutar `Categorías / Listar categorías`.
- Ejecutar `Categorías / Modificar categoría`.

Comprobar:

```sql
SELECT * FROM categories WHERE id = <categoryId>;
```

### 5. Producto

- Ejecutar `Administración de productos / Crear producto`. Guarda `productId`.
- Ejecutar `Administración de productos / Consultar producto como administrador`.
- Ejecutar `Productos públicos / Buscar y filtrar productos`.
- Ejecutar `Administración de productos / Desactivar producto`.
- Repetir `Productos públicos / Consultar producto`: debe responder `404` porque está desactivado.
- Ejecutar `Administración de productos / Listar productos inactivos`: debe mostrarlo.
- Activarlo nuevamente con `Administración de productos / Activar producto`.

Comprobar:

```sql
SELECT id, name, category_id, price, availability, is_active
FROM products
WHERE id = <productId>;
```

Intentar eliminar su categoría mientras el producto existe debe responder `409 CATEGORY_IN_USE`.

### 5.1. Productos destacados

- Ejecutar `Administración de productos / Destacar producto` con el producto activo.
- Ejecutar `Productos públicos / Listar destacados`: debe incluirlo y exponer `isFeatured: true`.
- Desactivar el producto: debe desaparecer de destacados públicos, pero seguir en `Administración de productos / Listar destacados`, conservando `isFeatured: true`.
- Activarlo nuevamente: debe reaparecer en destacados públicos.
- Ejecutar `Administración de productos / Quitar destacado`: debe desaparecer de la selección y continuar en el catálogo general si está activo.
- Combinar `isFeatured=true` con categoría, búsqueda y paginación; comprobar totales y resultados. Probar `isFeatured=false` para los no destacados.
- Un PATCH sin token debe devolver `401`; `{"isFeatured":"false"}` y un filtro `isFeatured=otro` deben devolver `400`.

```sql
SELECT id, name, is_active, is_featured FROM products ORDER BY id;
```

### 5.2. Galerías de imágenes

- `Crear producto` envía ahora dos URLs en `imageUrls`. Comprobar la colección ordenada y que `imageUrl` coincide con la primera.
- Ejecutar `Actualizar galería de imágenes`: cambia la principal y agrega otra imagen. Verificar el orden en detalle público y administrativo y en `product_images`.
- Quitar una entrada del arreglo y repetir PATCH: debe desaparecer solamente esa referencia. Enviar una sola URL es válido.
- Probar `imageUrls: []`, más de diez entradas, FTP y URLs repetidas: deben devolver `400 VALIDATION_ERROR` y conservar el producto y su galería anteriores.
- Probar PATCH solamente de precio o visibilidad: debe conservar las imágenes. Probar el campo anterior `imageUrl`: debe cambiar la principal sin perder secundarias. No mezclar ambos campos en una solicitud.
- Eliminar el producto y comprobar que sus filas en `product_images` desaparezcan.

```sql
SELECT product_id, position, url
FROM product_images
WHERE product_id = <productId>
ORDER BY position;
```

### 6. Consulta de visitante

- Ejecutar `Consultas / Enviar consulta` sin autenticación. Guarda `inquiryId`.
- Ejecutar `Consultas / Consultar consulta` con autenticación.
- Ejecutar `Consultas / Listar consultas pendientes` con autenticación.
- Ejecutar `Consultas / Marcar consulta como respondida`.

Comprobar:

```sql
SELECT id, name, email, subject, status
FROM inquiries
WHERE id = <inquiryId>;
```

### 7. Recuperación de contraseña

Para este TP no se integra un proveedor de correo real. Ejecutar este flujo en desarrollo o pruebas: la API devuelve `resetToken` en esos entornos y Postman lo guarda automáticamente. En producción la respuesta no incluye ese token.

- Ejecutar `Autenticación / Solicitar recuperación de contraseña`. En desarrollo guarda `resetToken`.
- Ejecutar `Autenticación / Restablecer contraseña`.
- El token JWT anterior queda revocado.
- Ejecutar `Autenticación / Iniciar sesión con la contraseña nueva` para guardar un token nuevo.

Comprobar que el token fue utilizado y las sesiones anteriores revocadas:

```sql
SELECT administrator_id, expires_at, used_at
FROM password_reset_tokens;

SELECT id, administrator_id, revoked_at
FROM auth_sessions
ORDER BY created_at DESC;
```

### 8. Eliminaciones

- Eliminar primero el producto.
- Eliminar después la categoría.
- Eliminar la consulta.
- Verificar que los `GET` correspondientes respondan `404`.

### 9. Cierre de sesión

- Ejecutar `Autenticación / Cerrar sesión`.
- `Autenticación / Consultar perfil` debe responder `401` usando el token revocado.

## Estados esperados

| Caso | Estado |
| --- | --- |
| Lectura o modificación exitosa | `200` |
| Creación exitosa | `201` |
| Solicitud de recuperación aceptada | `202` |
| Eliminación o cierre de sesión exitoso | `204` |
| Validación inválida | `400` |
| Token ausente, inválido o revocado | `401` |
| Recurso inexistente | `404` |
| Duplicado o categoría en uso | `409` |


## Regresión de validaciones

- En alta y edición de productos, enviar precio `null`, `true`, `"1.23"`, `1.001` y `1.000000001`: debe responder `400 VALIDATION_ERROR`, sin crear ni modificar registros. Probar precios numéricos `0`, `0.29` y `123.45`: deben guardarse exactamente.
- Probar categoría booleana y `2147483648`, y el mismo identificador en rutas de productos/categorías/consultas: debe devolver `400`, no un fallo de PostgreSQL.
- Probar imagen o red con `ftp://example.com`, `javascript:alert(1)`, URL incompleta y más de 2000 caracteres: deben rechazarse. HTTP/HTTPS completas deben aceptarse.
- Probar correo con puntos consecutivos y teléfono con letras o sin cinco dígitos: deben rechazarse. Correo con espacios exteriores/mayúsculas debe normalizarse; `+54 (11) 4444-5555` debe aceptarse.
- En Registro y Restablecimiento, probar 19 emojis de cuatro bytes: deben rechazarse antes de generar un hash; 18 cumplen el límite. La confirmación de contraseña es un control del frontend.
- Comprobar en SQL que los rechazos no cambien los registros anteriores. Las pruebas automáticas de integración verifican también esa conservación.
