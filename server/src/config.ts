import path from 'node:path';
import dotenv from 'dotenv';

// server/src o server/dist → raíz del proyecto
const ROOT = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT, '.env') });
const env = process.env;

/** Parsea LIBRARIES="Fotos=/mnt/ssd/Fotos|Imágenes=/mnt/hdd/Imágenes|Videos=/mnt/hdd/Videos"
 *  Si no está definida, usa PHOTOS_ROOT como biblioteca única llamada "Fotos". */
function parseLibraries(): Record<string, string> {
  const raw = env.LIBRARIES;
  if (raw && raw.trim()) {
    const libs: Record<string, string> = {};
    for (const entry of raw.split('|')) {
      const idx = entry.indexOf('=');
      if (idx < 1) continue;
      const name = entry.slice(0, idx).trim();
      const dir  = entry.slice(idx + 1).trim();
      if (name && dir) libs[name] = path.resolve(dir);
    }
    if (Object.keys(libs).length > 0) return libs;
  }
  // Compatibilidad: si no hay LIBRARIES, usa PHOTOS_ROOT con el nombre "Fotos"
  return { Fotos: path.resolve(env.PHOTOS_ROOT || '/mnt/ssd/Fotos') };
}

export const config = {
  root: ROOT,
  port: Number(env.PORT || 3002),
  host: env.HOST || '0.0.0.0',
  /** @deprecated Usar config.libraries en su lugar */
  photosRoot: path.resolve(env.PHOTOS_ROOT || '/mnt/ssd/Fotos'),
  /** Mapa nombre → ruta absoluta de cada biblioteca */
  libraries: parseLibraries(),
  dataDir: path.resolve(env.DATA_DIR || path.join(ROOT, 'data')),
  jwtSecret: env.JWT_SECRET || '',
  adminUser: env.ADMIN_USER || 'admin',
  adminPassword: env.ADMIN_PASSWORD || '',
  maxUploadMb: Number(env.MAX_UPLOAD_MB || 500),
  webDist: path.join(ROOT, 'web', 'dist'),
};
