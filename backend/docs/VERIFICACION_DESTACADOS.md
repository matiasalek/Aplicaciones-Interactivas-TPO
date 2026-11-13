# Verificación de productos destacados

Verificación del 13 de noviembre de 2026 con Node.js 24.20.0, Chromium y PostgreSQL 17. Se utilizaron bases temporales aisladas en el puerto 55459 y una API de pruebas en el puerto 3003; no se modificaron los datos de demostración.

## Resultados

- `npm test` del backend: 15 pruebas rápidas aprobadas.
- `npm run test:integration`: 17 pruebas aprobadas contra PostgreSQL real, incluidas las 12 anteriores y 5 de destacados.
- Frontend: 12 pruebas unitarias y 9 de navegador aprobadas, incluidos los recorridos previos.
- Sin dependencias nuevas en ninguno de los proyectos.

Las pruebas nuevas del servidor verifican creación con `true`, `false` y valor omitido, persistencia real, exposición en listados/detalles y validación estricta de booleanos JSON y filtros. Comprueban autenticación, ocultamiento público de inactivos, filtros combinados con búsqueda/categoría/disponibilidad, orden, paginación, totales, respuestas vacías y edición de campos independientes.

Se comprueba que desactivar y reactivar conserva el destacado, que quitar el destacado no cambia la visibilidad y que repetir el seed conserva las selecciones administradas.

## Compatibilidad de instalaciones

1. Se preparó `pixel_forge_featured_upgrade` con las primeras cinco migraciones y los veinte productos del seed.
2. Se guardaron los datos completos de productos y categorías y se aplicó el migrador actual: agregó únicamente `006_add_featured_products.sql`.
3. Se compararon todos los campos anteriores, incluidos identificadores y fechas: se conservaron. Los veinte productos quedaron con `is_featured = false`.
4. Se repitió el migrador: no aplicó cambios adicionales y quedaron seis versiones registradas.
5. En otra base vacía, `pixel_forge_featured_sql`, se ejecutó `database/create_database.sql`. El migrador posterior reconoció las seis versiones y el seed cargó seis categorías y veinte productos.

## Reproducción

Desde `backend/`, usar Node.js 24 y una base exclusiva de pruebas. Las pruebas de integración existentes eliminan datos; no usar una base de demostración.

```bash
npm test
TEST_DATABASE_URL=postgresql://localhost:5432/gamer_store_test \
DATABASE_URL=postgresql://localhost:5432/gamer_store_test \
NODE_ENV=test npm run test:integration
```

Las pruebas de navegador se ejecutan desde el frontend con una API conectada a otra base de pruebas, seis migraciones y seed. El detalle está en su README y en `docs/VERIFICACION.md` de ese repositorio.

Los servicios temporales quedaron detenidos al finalizar. Para actualizar la base local de uso normal, detener la API, ejecutar `npm run db:migrate` y reiniciarla. No hace falta repetir el seed ni recrear la base.


## Revisión posterior de validaciones

El 13 de noviembre de 2026 se ampliaron y alinearon las validaciones de ambos proyectos. El contrato está en `VALIDACIONES.md`. Las pruebas finales aprobaron 22 casos rápidos y 21 de integración en el backend, y 18 unitarios y 11 de navegador en el frontend, incluidos todos los recorridos anteriores. Se mantuvieron las seis migraciones y las dependencias existentes.

Se verificaron precios estrictos y centavos sin redondeo, identificadores dentro del rango de PostgreSQL, protocolos y longitudes de URLs, correos normalizados, teléfonos y contraseñas UTF-8. Las comprobaciones HTTP compararon datos anteriores y posteriores para asegurar que las entradas inválidas no se persistieran.

El frontend también corrigió el desplazamiento del botón de envío cuando aparece un error al salir del último campo: las pruebas comprueban que un único clic valida, enfoca el primer error y no envía solicitudes de escritura con datos inválidos.

Se utilizaron bases nuevas y aisladas en PostgreSQL 17, puerto 55469: `pixel_forge_validation_integration` y `pixel_forge_validation_e2e`; API temporal 3004. No se usó ni migró la base de demostración. Los servicios temporales se detuvieron al terminar.
