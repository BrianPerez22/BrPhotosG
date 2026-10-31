import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import { HttpError, initRoot } from './fsutil';
import { addUser, listUsers, loadUsers, newId } from './store';
import { authRoutes } from './routes-auth';
import { fileRoutes } from './routes-files';
import { adminRoutes } from './routes-admin';

if (config.jwtSecret.length < 32) {
  console.error('JWT_SECRET debe tener al menos 32 caracteres (openssl rand -hex 32). Revisa tu .env');
  process.exit(1);
}
initRoot();
loadUsers();

if (!listUsers().some((u) => u.role === 'admin')) {
  if (!config.adminPassword) { console.error('No hay administrador: define ADMIN_USER y ADMIN_PASSWORD en .env'); process.exit(1); }
  addUser({
    id: newId(), username: config.adminUser, passwordHash: bcrypt.hashSync(config.adminPassword, 10), role: 'admin',
    perms: { view: true, download: true, upload: true, delete: true }, folders: [], createdAt: new Date().toISOString(), tokenVersion: 1,
  });
  console.log(`Administrador inicial creado: ${config.adminUser}`);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(helmet({
  hsts: false,
  contentSecurityPolicy: { useDefaults: true, directives: { 'upgrade-insecure-requests': null, 'img-src': ["'self'", 'data:', 'blob:'] } },
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', fileRoutes);
app.use('/api', (_req, res) => { res.status(404).json({ error: 'No encontrado' }); });

// Frontend compilado
if (fs.existsSync(config.webDist)) {
  app.use('/assets', express.static(path.join(config.webDist, 'assets'), { immutable: true, maxAge: '30d' }));
  app.use(express.static(config.webDist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(config.webDist, 'index.html'));
  });
}

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) return res.status(413).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `Archivo demasiado grande (máx. ${config.maxUploadMb} MB)` : err.message });
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

app.listen(config.port, config.host, () => {
  console.log(`Galería escuchando en http://${config.host}:${config.port}  ·  fotos: ${config.photosRoot}`);
});
