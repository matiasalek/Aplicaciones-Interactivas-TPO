# Validaciones de entrada

El frontend valida para informar errores de inmediato. La API aplica sus propias validaciones con Zod antes de ejecutar operaciones de negocio; PostgreSQL garantiza unicidad, relaciones y restricciones de datos. Una solicitud directa no puede depender de lo que haya comprobado el navegador.

## Contratos

| Dato                     | Regla                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precio                   | Número JSON finito, entre 0 y 9999999999.99, con hasta dos decimales. Se rechazan `null`, booleanos, arreglos, objetos y cadenas, incluso si contienen números. No se redondean entradas inválidas.                                                                                                                                                     |
| Categoría de un producto | Número JSON entero entre 1 y 2147483647, rango de las claves integer de PostgreSQL. Los filtros de URL reciben el identificador como texto de dígitos y lo convierten tras validarlo. El mismo rango se aplica a los identificadores de productos, categorías y consultas en las rutas. La existencia se garantiza mediante la relación con categorías. |
| Imagen y redes           | URL completa HTTP/HTTPS, con hasta 2000 caracteres después de quitar espacios exteriores. Otros protocolos se rechazan.                                                                                                                                                                                                                                 |
| Correo                   | Se quitan espacios exteriores antes de validar el formato práctico de `z.email()`, se limita a 320 caracteres y se normaliza a minúsculas. Se usa el mismo esquema en autenticación, perfil y consultas.                                                                                                                                                |
| Teléfono                 | Hasta 50 caracteres y al menos 5 dígitos. Se permiten espacios, puntos, guiones, paréntesis y `+` al inicio. No se fija un país. En consultas puede omitirse o enviarse `null`.                                                                                                                                                                         |
| Contraseña nueva         | De 8 a 72 caracteres y hasta 72 bytes UTF-8. Se rechazan valores que la biblioteca truncaría, incluidos textos con demasiados emojis. Se aplica a registro y restablecimiento; no se endurece el inicio de sesión de cuentas existentes.                                                                                                                |
| Destacado y visibilidad  | Booleanos JSON. No se aceptan textos como `"false"`.                                                                                                                                                                                                                                                                                                    |

Los esquemas reutilizables están en `src/validators/common.schemas.js`. La confirmación de contraseña se comprueba en el frontend y no se envía a la API. Los correos y nombres duplicados se resuelven definitivamente con restricciones únicas; las credenciales, sesiones y permisos se comprueban en el servidor.

Las entradas inválidas devuelven `400 VALIDATION_ERROR`, con `error.details` para los campos correspondientes. El rechazo ocurre antes de escribir registros. Estas correcciones no requieren otra migración, no reescriben datos existentes y no agregan dependencias.

## Galerías

Alta acepta `imageUrls` o el campo anterior `imageUrl`, sin mezclar ambos. La colección requiere entre una y diez referencias de hasta 2000 caracteres. Se aceptan URLs completas HTTP/HTTPS y rutas propias `/api/v1/media/products/<archivo>.webp`. Se recortan los espacios y se rechazan referencias repetidas, colecciones vacías y valores que incumplan el formato. Los errores señalan el índice correspondiente, por ejemplo `imageUrls.1`.

PATCH con `imageUrls` reemplaza la colección completa; con `imageUrl` cambia la principal conservando secundarias. Omitir ambos campos conserva las imágenes. Se guardan producto y galería en una sola transacción, con bloqueo de la fila al editar. Las imágenes anteriores se migran mediante `007_create_product_images.sql`.

## Filtros de precio

Los listados público y administrativo admiten `minPrice` y `maxPrice` opcionales. En la URL son importes decimales con punto, no negativos, con hasta dos decimales y dentro del mismo máximo que el precio de producto. Se convierten a números después de validar el formato; se rechazan rangos invertidos, cadenas vacías, formatos no numéricos y parámetros repetidos. Ambos extremos son inclusivos, incluido cero. Se puede omitir uno o ambos límites.

Se aplican con SQL parametrizado antes de ordenar y paginar, combinados con las condiciones existentes. No hay cambios de base de datos ni dependencias adicionales.

## Comprobaciones

Las pruebas rápidas incluyen precios límite, cero y centavos, protocolos de URL, longitudes, identificadores, booleanos, correos normalizados, teléfonos y contraseñas UTF-8. Las pruebas HTTP con PostgreSQL real comprueban que las entradas inválidas no creen productos ni modifiquen registros existentes, y que los valores válidos se persistan sin redondeo.

Los recorridos de navegador del frontend comprueban errores y foco antes de enviar, ausencia de solicitudes de escritura para formularios inválidos, corrección de los campos y guardado de un precio de 0.29.
