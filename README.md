# Galería de fotos autoalojada

Galería web para ver las fotos de un servidor propio, con usuarios, carpetas compartidas y permisos.

- **Estilo**: mezcla de Finder (carpetas como álbumes, vista cuadrícula/lista, barra lateral) y Google Fotos (fotos agrupadas por día, selección múltiple, visor a pantalla completa).
- **Usuarios**: el administrador crea usuarios, les asigna contraseña, las carpetas que pueden ver y sus permisos: **ver, descargar, subir, eliminar**.
- **Seguridad**: cada usuario solo accede a las carpetas asignadas (y sus subcarpetas); las rutas se validan en el servidor contra salidas de la carpeta raíz; las contraseñas se guardan con bcrypt; bloqueo tras 5 intentos fallidos.
- **Eliminar** mueve a una `.papelera` dentro de la carpeta raíz (recuperable a mano).
- **Stack**: React + TypeScript + Tailwind CSS (Vite) · Node.js + Express + TypeScript · miniaturas con `sharp` (caché en disco). Sin base de datos: los usuarios viven en `data/users.json`.

## Requisitos

Node.js 20 o superior y una carpeta con fotos.

## Instalación

```bash
git clone <URL-DEL-REPOSITORIO> galeria-fotos
cd galeria-fotos
cp .env.example .env        # edita los valores (ver abajo)
npm run install:all         # instala dependencias de server/ y web/
npm run build               # compila el frontend y el backend
npm start                   # http://localhost:3002
```

### Variables de `.env`

| Variable | Descripción |
| --- | --- |
| `PORT` / `HOST` | Puerto (3002) y dirección de escucha |
| `PHOTOS_ROOT` | Carpeta raíz de las fotos (lectura y escritura) |
| `DATA_DIR` | Usuarios y miniaturas (por defecto `./data`) |
| `JWT_SECRET` | Aleatorio, 32+ caracteres (`openssl rand -hex 32`) |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Administrador inicial; solo se crea si aún no hay ninguno |
| `MAX_UPLOAD_MB` | Tamaño máximo por archivo |

`.env` y `data/` están en `.gitignore`: nunca se suben al repositorio.

## Desarrollo

Dos terminales: `npm run dev:server` (API en el puerto 3002) y `npm run dev:web` (Vite en el 5173, con proxy a `/api`).

## Notas

- Formatos: JPG, PNG, GIF, WebP, AVIF, BMP y vídeos MP4/WebM/MOV/M4V (los vídeos no tienen miniatura).
- Los permisos son por usuario y se aplican a todas sus carpetas asignadas.
- Quien puede **ver** una foto técnicamente puede guardarla desde el navegador; el permiso «descargar» controla el botón y el endpoint de descarga, no es DRM.
- Detrás de un proxy/túnel, la app confía en el proxy local (`loopback`) y usa `CF-Connecting-IP` para limitar intentos de inicio de sesión.
