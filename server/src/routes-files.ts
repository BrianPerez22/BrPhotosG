import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { effectivePerms, need, requireAuth } from './auth';
import { accessRoot, canAccess, HttpError, mediaType, normalizeRel, REAL_ROOT, resolveSafe, TMP_NAME, TRASH_NAME, uniqueName, validName } from './fsutil';
import { config } from './config';
import { getThumb, type SizeKey } from './thumbs';

export const fileRoutes = Router();
fileRoutes.use(requireAuth);

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

async function folderEntry(rel: string) {
  try {
    const abs = await resolveSafe(rel);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    let count = 0, subfolders = 0;
    let cover: string | null = null;
    const names = entries.filter((e) => !e.name.startsWith('.')).sort((a, b) => collator.compare(a.name, b.name));
    for (const e of names) {
      if (e.isDirectory()) subfolders++;
      else if (e.isFile()) {
        const t = mediaType(e.name);
        if (t) { count++; if (!cover && t === 'image') cover = `${rel}/${e.name}`; }
      }
    }
    return { name: path.basename(rel), path: rel, cover, count, subfolders };
  } catch { return null; }
}

fileRoutes.get('/browse', need('view'), async (req, res) => {
  const user = req.user!;
  const rel = normalizeRel(req.query.path);
  const perms = effectivePerms(user);

  if (user.role !== 'admin' && rel === '') {
    const list = (await Promise.all(user.folders.map(folderEntry))).filter(Boolean);
    return res.json({ path: '', parent: null, crumbs: [], folders: list, files: [], canWrite: false });
  }
  if (!canAccess(user, rel)) throw new HttpError(403, 'No tienes acceso a esta carpeta');

  const abs = await resolveSafe(rel);
  const st = await fs.stat(abs);
  if (!st.isDirectory()) throw new HttpError(400, 'No es una carpeta');
  const entries = await fs.readdir(abs, { withFileTypes: true });

  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
  const folders = (await Promise.all(dirs.map((d) => folderEntry(rel ? `${rel}/${d.name}` : d.name))))
    .filter((f): f is NonNullable<typeof f> => !!f)
    .sort((a, b) => collator.compare(a.name, b.name));

  const media = entries.filter((e) => e.isFile() && !e.name.startsWith('.') && mediaType(e.name));
  const files = (await Promise.all(media.map(async (e) => {
    const s = await fs.stat(path.join(abs, e.name));
    return { name: e.name, path: rel ? `${rel}/${e.name}` : e.name, type: mediaType(e.name)!, size: s.size, mtime: s.mtimeMs };
  }))).sort((a, b) => b.mtime - a.mtime);

  const base = accessRoot(user, rel) ?? '';
  const baseParts = base ? base.split('/') : [];
  const parts = rel ? rel.split('/') : [];
  const crumbs: { name: string; path: string }[] = [];
  for (let i = Math.max(baseParts.length - 1, 0); i < parts.length; i++) crumbs.push({ name: parts[i], path: parts.slice(0, i + 1).join('/') });
  const parent = rel === '' ? null : (user.role !== 'admin' && rel === base) ? '' : parts.slice(0, -1).join('/');

  res.json({ path: rel, parent, crumbs, folders, files, canWrite: user.role === 'admin' || (perms.upload && rel !== '') });
});

async function mediaFile(req: Request, kind?: 'image') {
  const rel = normalizeRel(req.query.path);
  if (!rel || !canAccess(req.user!, rel)) throw new HttpError(403, 'Acceso denegado');
  const t = mediaType(rel);
  if (!t || (kind && t !== kind)) throw new HttpError(415, 'Tipo de archivo no soportado');
  const abs = await resolveSafe(rel);
  if (!(await fs.stat(abs)).isFile()) throw new HttpError(404, 'No encontrado');
  return { rel, abs };
}

fileRoutes.get('/thumb', need('view'), async (req, res) => {
  const { abs } = await mediaFile(req, 'image');
  const size: SizeKey = req.query.s === 'lg' ? 'lg' : 'sm';
  let out: string;
  try { out = await getThumb(abs, size); } catch { throw new HttpError(415, 'No se pudo generar la miniatura'); }
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(out, { cacheControl: false, dotfiles: 'allow' });
});

fileRoutes.get('/file', need('view'), async (req, res) => {
  const { rel, abs } = await mediaFile(req);
  const download = req.query.download === '1';
  if (download && !effectivePerms(req.user!).download) throw new HttpError(403, 'No tienes permiso para descargar');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (download) res.attachment(path.basename(rel));
  res.sendFile(abs, { cacheControl: false, dotfiles: 'allow' }); // sendFile soporta Range (vídeo)
});

// ---- Subida ----
const fixName = (n: string) => {
  if (/[^\u0000-\u00ff]/.test(n)) return n;
  const d = Buffer.from(n, 'latin1').toString('utf8');
  return d.includes('\ufffd') ? n : d;
};

async function prepUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const rel = normalizeRel(req.query.path);
    if (!rel && req.user!.role !== 'admin') throw new HttpError(403, 'Elige una carpeta para subir');
    if (!canAccess(req.user!, rel)) throw new HttpError(403, 'Acceso denegado');
    const dir = await resolveSafe(rel);
    if (!(await fs.stat(dir)).isDirectory()) throw new HttpError(400, 'No es una carpeta');
    res.locals.dir = dir;
    res.locals.skipped = [] as string[];
    next();
  } catch (e) { next(e); }
}

const uploader = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, path.join(REAL_ROOT, TMP_NAME)),
    filename: (_r, _f, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 200 },
  fileFilter: (req, file, cb) => {
    const name = fixName(file.originalname);
    if (mediaType(name)) return cb(null, true);
    (req as any).skipped = [...((req as any).skipped ?? []), name];
    cb(null, false);
  },
});

fileRoutes.post('/upload', need('upload'), prepUpload, uploader.array('files', 200), async (req, res) => {
  const dir = res.locals.dir as string;
  const list = (req.files ?? []) as Express.Multer.File[];
  let uploaded = 0;
  for (const f of list) {
    try {
      let name = fixName(f.originalname).replace(/[\/\\\0]/g, '_').replace(/^\.+/, '') || 'archivo';
      name = await uniqueName(dir, name);
      await fs.rename(f.path, path.join(dir, name));
      uploaded++;
    } catch { await fs.rm(f.path, { force: true }); }
  }
  res.json({ uploaded, skipped: (req as any).skipped ?? [] });
});

// ---- Crear carpeta ----
fileRoutes.post('/folders', async (req, res) => {
  const user = req.user!;
  const rel = normalizeRel(req.body?.path);
  const name = validName(req.body?.name);
  const allowed = user.role === 'admin' || (effectivePerms(user).upload && rel !== '' && canAccess(user, rel));
  if (!allowed) throw new HttpError(403, 'No tienes permiso para crear carpetas aquí');
  const parent = await resolveSafe(rel);
  try { await fs.mkdir(path.join(parent, name)); }
  catch (e: any) { throw new HttpError(e.code === 'EEXIST' ? 409 : 500, e.code === 'EEXIST' ? 'Ya existe una carpeta con ese nombre' : 'No se pudo crear la carpeta'); }
  res.status(201).json({ path: rel ? `${rel}/${name}` : name });
});

// ---- Eliminar (mueve a .papelera; las carpetas solo el admin) ----
fileRoutes.post('/delete', need('delete'), async (req, res) => {
  const user = req.user!;
  const paths: unknown = req.body?.paths;
  if (!Array.isArray(paths) || !paths.length || paths.length > 500) throw new HttpError(400, 'Nada que eliminar');
  let deleted = 0;
  for (const p of paths) {
    const rel = normalizeRel(p);
    if (!rel || !canAccess(user, rel)) continue;
    const abs = await resolveSafe(rel).catch(() => null);
    if (!abs) continue;
    const st = await fs.stat(abs);
    if (st.isDirectory() && user.role !== 'admin') continue;
    if (st.isFile() && !mediaType(rel)) continue;
    const trash = path.join(REAL_ROOT, TRASH_NAME);
    await fs.mkdir(trash, { recursive: true });
    await fs.rename(abs, path.join(trash, `${Date.now()}_${rel.replace(/\//g, '__')}`));
    deleted++;
  }
  res.json({ deleted });
});
