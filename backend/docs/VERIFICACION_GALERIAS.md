# Verificación de galerías de imágenes

Verificación del 13 de noviembre de 2026 con Node.js 24.20.0, PostgreSQL 17 y Chromium. Se utilizaron bases aisladas en el puerto 55479 y una API temporal en 3005; no se utilizó ni migró la base de demostración.

## Resultados

- Backend: 26 pruebas rápidas y 29 de integración aprobadas, incluidos los recorridos anteriores. Se agregaron cuatro pruebas rápidas y ocho de integración para galerías.
- Frontend: 21 pruebas unitarias y 13 de navegador aprobadas. Se agregaron tres unitarias y dos recorridos de galería.
- Build y formato aprobados. Sin dependencias nuevas.

## Persistencia y contratos

Se verificaron creación, lectura pública/administrativa, orden, imagen principal, eliminación individual mediante reemplazo de colección y conservación de imágenes al editar otros campos. La paginación no duplica productos por tener varias imágenes.

Se rechazaron arreglos vacíos, más de diez URLs, protocolos no permitidos, valores no textuales, URLs demasiado largas y duplicados normalizados. Se mantuvo el contrato anterior `imageUrl`, sin perder secundarias al modificar solamente la principal. Los productos inactivos siguieron ocultos y los destacados conservaron sus imágenes.

Una falla de inserción simulada mediante un trigger de prueba comprobó el rollback completo tanto de alta como de edición: no quedaron productos parciales ni se perdieron imágenes anteriores. También se probaron solicitudes simultáneas para comprobar que no mezclaran colecciones.

Repetir el seed conservó galerías administradas. Eliminar el producto eliminó sus filas de imágenes en cascada; una edición posterior devolvió 404.

## Actualización de instalaciones

Se creó otra base con las primeras seis migraciones y los veinte productos reales del seed anterior. Se variaron visibilidad y selección de destacados y se guardaron todos sus datos. El migrador aplicó únicamente la migración 007: cada producto mantuvo todos sus campos y recibió una fila de imagen con su URL anterior en posición 0. Se conservaron también las categorías.

Repetir el migrador no aplicó cambios adicionales. En otra base vacía se ejecutó `database/create_database.sql`; el migrador reconoció las siete versiones y el seed creó veinte productos con veinte imágenes iniciales.

## Interfaz y accesibilidad

Se verificó el editor para agregar, quitar y ordenar, cambiar la principal, validar por fila y limitar a diez imágenes. Los errores no enviaron datos y enfocaron la fila correspondiente. El detalle permitió seleccionar miniaturas con mouse y teclado; una imagen inaccesible mostró su alternativa sin impedir usar las demás. Las tarjetas usaron la nueva principal después de guardar.

Se revisaron capturas de detalle y editor en 375 y 1440 píxeles, y se comprobó ausencia de desborde de página también en 768 y 1024. Las comprobaciones axe incluidas del detalle y editor no detectaron violaciones; no constituyen una auditoría completa de accesibilidad. Las capturas y trazas permanecen ignoradas en el frontend.

Los servicios temporales se detuvieron al finalizar. Para una instalación anterior, detener la API, ejecutar `npm run db:migrate` y reiniciarla. No recrear la base ni repetir el seed.
