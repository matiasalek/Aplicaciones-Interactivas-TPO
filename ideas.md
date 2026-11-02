# Idea y alcance del proyecto

> Fuente de verdad: **TPO Segundo Cuatrimestre 2026.pdf**. Este documento propone una implementación concreta sin reemplazar ni ampliar los requisitos obligatorios de la consigna.

## Propuesta

Desarrollar una plataforma web para un pequeño comercio de componentes para videojuegos. No será un comercio electrónico transaccional: la consigna no exige carrito, pagos, envíos ni compras en línea. El objetivo será promocionar productos y permitir que potenciales clientes conozcan el comercio y envíen consultas.

La aplicación tendrá dos áreas:

- **Sitio público:** información del comercio, catálogo de productos, búsqueda, filtro por categoría, datos de contacto y formulario de consultas.
- **Área privada de administración:** gestión del perfil, información institucional, productos, categorías y consultas recibidas.

La temática de componentes para videojuegos es una decisión del grupo permitida por la consigna. El **Asistente de Armado de PC** puede incorporarse como funcionalidad propia después de completar los requisitos obligatorios. No forma parte del alcance mínimo ni de las funcionalidades adicionales enumeradas en el PDF.

## Requisitos obligatorios

### Sitio público

Un visitante deberá poder:

- Conocer la información general del comercio.
- Visualizar los productos ofrecidos.
- Buscar publicaciones.
- Filtrar publicaciones por categoría.
- Consultar la información de contacto.
- Enviar consultas al comercio.

Cada producto deberá mostrar, como mínimo:

- Nombre.
- Categoría.
- Imagen.
- Descripción.
- Precio, si corresponde al rubro.
- Estado de disponibilidad.

La base de datos deberá incluir al menos **20 productos precargados** para demostrar búsquedas, filtros y navegación.

### Registro, autenticación y perfil

El administrador deberá poder:

- Registrarse.
- Iniciar y cerrar sesión.
- Recuperar su contraseña.
- Modificar sus datos personales.

Datos mínimos del registro:

- Nombre y apellido.
- Correo electrónico.
- Teléfono.
- Contraseña.

No se permitirán usuarios con correos electrónicos duplicados.

### Información institucional

El administrador deberá poder crear y modificar:

- Nombre del comercio.
- Descripción.
- Dirección.
- Teléfono.
- Redes sociales.
- Horarios de atención.

### Productos

El administrador deberá poder:

- Crear productos.
- Modificar productos.
- Eliminar productos.
- Activar o desactivar productos.

Cada publicación deberá guardar nombre, categoría, descripción, al menos una imagen, precio cuando corresponda y estado de disponibilidad. La gestión de múltiples imágenes puede tratarse como una mejora adicional.

### Categorías

El administrador deberá poder crear, modificar y eliminar categorías. Cada producto deberá estar asociado a una categoría.

El comportamiento al eliminar una categoría que todavía tenga productos asociados no está definido por la consigna. Se recomienda impedir la eliminación y mostrar un mensaje claro hasta que esos productos sean reasignados o eliminados.

### Formulario y gestión de consultas

El formulario público deberá solicitar:

- Nombre.
- Correo electrónico.
- Teléfono opcional.
- Asunto.
- Mensaje.

Las consultas deberán almacenarse en la base de datos. En el panel privado, el administrador deberá poder visualizarlas, eliminarlas y cambiar su estado entre **Pendiente**, **Leída** y **Respondida**.

### Roles

- **Visitante:** navega publicaciones, realiza búsquedas y envía consultas.
- **Administrador:** gestiona su perfil, productos, categorías, consultas e información del comercio.

## Requisitos técnicos

- Interfaz web con React, HTML, CSS y JavaScript.
- React Router para la navegación.
- Componentes reutilizables.
- Servidor con Node.js y Express.
- API REST consumida por la interfaz web.
- Base de datos SQL o NoSQL con persistencia real.
- Separación entre la interfaz web y el servidor.
- Autenticación y autorización.
- Manejo de errores.
- Validaciones en la interfaz web y en el servidor para **todos** los formularios.
- Diseño adaptable a dispositivos móviles.

## Tecnologías propuestas

La consigna permite elegir la base de datos y las herramientas complementarias. Para esta propuesta se recomienda:

El backend ya está implementado con Node.js, Express, PostgreSQL mediante `pg` sin ORM, Zod, JWT y `bcryptjs`. Las propuestas de interfaz web de esta sección corresponden a una etapa futura.

### Interfaz web

- **React + React Router:** tecnologías obligatorias para la interfaz y navegación.
- **React Hook Form + Zod:** formularios y validaciones reutilizables.
- **Fetch o Axios:** consumo de la API REST; conviene elegir uno y usarlo de forma consistente.
- **Context API:** manejo de la sesión del administrador. Redux no parece necesario para este alcance.
- **CSS Modules o Tailwind CSS:** cualquiera es válido; la elección deberá priorizar un diseño adaptable y consistente.

### Servidor

- **Node.js + Express:** tecnologías obligatorias para construir la API REST.
- **Zod:** validaciones y normalización del lado del servidor, ya implementadas. El servidor siempre valida por separado.
- **JWT:** autenticación del administrador.
- **bcrypt:** resumen criptográfico seguro de contraseñas.
- **Imágenes mediante URL:** estrategia implementada; cada producto guarda una URL de imagen obligatoria.
- **Correo:** no se integra un proveedor real para este TP. La recuperación de contraseña se prueba con el token devuelto por la API en desarrollo y pruebas.

### Base de datos

Se utiliza **PostgreSQL** porque el dominio tiene relaciones claras entre administradores, productos, categorías y consultas. Permite aplicar claves foráneas, restricciones e índices únicos para evitar correos duplicados.

El acceso a datos está implementado mediante consultas parametrizadas con `pg`, sin ORM. El repositorio incluye el archivo SQL de creación de la base de datos y una carga inicial idempotente de seis categorías y veinte productos.

## Funcionalidades adicionales

La consigna otorga puntaje adicional por:

- Envío de correos desde el formulario de contacto.
- Panel con métricas y estadísticas.
- Gestión de múltiples imágenes por publicación.
- Buscador avanzado.
- Sistema de promociones o novedades.
- Productos destacados.

Además, para la temática elegida se propone un **Asistente de Armado de PC** que valide compatibilidad básica entre procesador, placa madre y memoria RAM. Es una función personalizada y debería abordarse únicamente cuando el alcance obligatorio esté terminado y probado.

## Documentación a entregar

- Descripción funcional del sistema.
- Modelo de datos.
- Diagrama de navegación.
- Manual de instalación.
- Código fuente de la interfaz web.
- Código fuente del servidor.
- Archivo SQL de creación de la base de datos.

## Prioridades sugeridas

1. Completar y probar todos los requisitos obligatorios.
2. Cargar los 20 productos y verificar búsquedas, filtros y navegación.
3. Asegurar diseño adaptable, validaciones, autenticación, autorización y manejo de errores.
4. Preparar la documentación y la presentación.
5. Incorporar funcionalidades adicionales sin comprometer el alcance principal.

La evaluación asigna **40%** a funcionalidades y calidad técnica, **40%** a diseño, usabilidad y experiencia de usuario, y **20%** a documentación y presentación. Por eso, las funcionalidades adicionales no deberían desplazar el trabajo sobre el catálogo, el panel administrativo, la experiencia adaptable ni la documentación.
