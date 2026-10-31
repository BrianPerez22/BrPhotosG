import path from 'node:path';
import dotenv from 'dotenv';

// server/src o server/dist → raíz del proyecto
const ROOT = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT, '.env') });
const env = process.env;

export const config = {
  root: ROOT,
  port: Number(env.PORT || 3002),
  host: env.HOST || '0.0.0.0',
  photosRoot: path.resolve(env.PHOTOS_ROOT || '/mnt/ssd/Fotos'),
  dataDir: path.resolve(env.DATA_DIR || path.join(ROOT, 'data')),
  jwtSecret: env.JWT_SECRET || '',
  adminUser: env.ADMIN_USER || 'admin',
  adminPassword: env.ADMIN_PASSWORD || '',
  maxUploadMb: Number(env.MAX_UPLOAD_MB || 500),
  webDist: path.join(ROOT, 'web', 'dist'),
};
