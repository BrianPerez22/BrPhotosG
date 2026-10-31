import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { effectivePerms, need, requireAuth } from './auth';
import {
  canAccess, HttpError, LIBRARIES, mediaType, normalizeLibRel,
  resolveSafe, splitLibRel, joinLibRel, libRoot, TMP_NAME, TRASH_NAME, uniqueName, validName,
} from './fsutil';
import { config } from './config';
import { getThumb, type SizeKey } from './thumbs';
import { getCaptureDate, syncFileMtime } from './metadata';

export const fileRoutes = Router();
fileRoutes.use(requireAuth);

const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

// ---------------------------------------------------------------------------
// Entrada de carpeta
// ---------------------------------------------------------------------------
async function folderEntry(libRel: string) {
  try {
    const abs = await resolveSafe(libRel);
    const entries = await fs.readdir(abs, { withFileTypes: true });
    let count = 0, subfolders = 0;
    let cover: string | null = null;
    const names = entries.filter((e) => !e.name.startsWith('.')).sort((a, b) => collator.compare(a.name, b.name));
    const { libName, rel } = splitLibRel(libRel);
    for (const e of names) {
      if (e.isDirectory()) subfolders++;
      else if (e.isFile()) {
        const t = mediaType(e.name);
        if (t) {
          count++;
          if (!cover && t === 'image') {
            cover = joinLibRel(libName, rel ? `${rel}/${e.name}` : e.name);
          }
        }
      }
    }
    const name = rel ? path.basename(rel) : libName;
    return { name, path: libRel, cover, count, subfolders };
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// GET /browse  →  ?path=LibName:rel/path  (o vacío para raíz de todas las libs)
// ---------------------------------------------------------------------------
fileRoutes.get('/browse', need('view'), async (req, res) => {
  const user = req.user!;
  const rawPath = req.query.path as string | undefined;

  // ── Raíz global (path vacío o sin prefijo vacío) ─────────────────────────
  if (!rawPath || rawPath === '') {
    if (user.role === 'admin') {
      // Admin: muestra todas las bibliotecas como carpetas raíz
      const libFolders = await Promise.all(
        Object.keys(LIBRARIES).map(async (libName) => {
          const libRel = joinLibRel(libName, '');
          try {
            const abs = libRoot(libName);
            const entries = await fs.readdir(abs, { withFileTypes: true });
            let count = 0, subfolders = 0;
            let cover: string | null = null;
            for (const e of entries.filter((x) => !x.name.startsWith('.'))) {
              if (e.isDirectory()) subfolders++;
              else if (e.isFile()) {
                const t = mediaType(e.name);
                if (t) { count++; if (!cover && t === 'image') cover = joinLibRel(libName, e.name); }
              }
            }
            return { name: libName, path: libRel, cover, count, subfolders };
          } catch { return null; }
        })
      );
      return res.json({
        path: '', parent: null, crumbs: [], isLibraryRoot: true,
        libraries: Object.keys(LIBRARIES),
        folders: libFolders.filter(Boolean),
        files: [], canWrite: false,
      });
    }

    // Usuario no-admin: muestra sus carpetas permitidas
    const list = (await Promise.all(user.folders.map(folderEntry))).filter(Boolean);
    return res.json({
      path: '', parent: null, crumbs: [], isLibraryRoot: false,
      libraries: [],
      folders: list, files: [], canWrite: false,
    });
  }

  // ── Ruta dentro de una biblioteca ────────────────────────────────────────
  const libRelPath = normalizeLibRel(rawPath);
  const { libName, rel } = splitLibRel(libRelPath);

  // Raíz de biblioteca (rel vacío)
  if (rel === '' || rel === undefined) {
    if (user.role !== 'admin') {
      // Usuario: filtra solo carpetas a las que tiene acceso en esta biblioteca
      const allowed = user.folders.filter((f) => f.startsWith(`${libName}${':'}`));
      const list = (await Promise.all(allowed.map(folderEntry))).filter(Boolean);
      return res.json({
        path: libRelPath, parent: '', crumbs: [], isLibraryRoot: false,
        libraries: [],
        folders: list, files: [], canWrite: false,
      });
    }
    // Admin: muestra contenido de la raíz de la biblioteca
  }

  if (!canAccess(user, libRelPath)) throw new HttpError(403, 'No tienes acceso a esta carpeta');

  const abs = await resolveSafe(libRelPath);
  const st  = await fs.stat(abs);
  if (!st.isDirectory()) throw new HttpError(400, 'No es una carpeta');
  const entries = await fs.readdir(abs, { withFileTypes: true });

  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
  const folders = (await Promise.all(
    dirs.map((d) => folderEntry(joinLibRel(libName, rel ? `${rel}/${d.name}` : d.name)))
  )).filter((f): f is NonNullable<typeof f> => !!f)
    .sort((a, b) => collator.compare(a.name, b.name));

  const media = entries.filter((e) => e.isFile() && !e.name.startsWith('.') && mediaType(e.name));
  const files = await Promise.all(media.map(async (e) => {
    const filePath = joinLibRel(libName, rel ? `${rel}/${e.name}` : e.name);
    const fileAbs  = path.join(abs, e.name);
    const s        = await fs.stat(fileAbs);
    const mtime    = s.mtimeMs;
    const fileType = mediaType(e.name)!;
    const cdate    = await getCaptureDate(fileAbs, mtime, fileType === 'image');
    return { name: e.name, path: filePath, type: fileType, size: s.size, mtime, cdate };
  }));
  // Ordenar por fecha de captura descendente por defecto en el servidor
  files.sort((a, b) => b.cdate - a.cdate);

  // Breadcrumbs: excluye el segmento de biblioteca; empieza desde la raíz de lib
  const relParts = rel ? rel.split('/') : [];
  const crumbs: { name: string; path: string }[] = [];
  // Si hay acceso con un folder-root de usuario, omite segmentos previos a él
  const baseAccess = user.role === 'admin' ? '' : (user.folders.find((f) => libRelPath === f || libRelPath.startsWith(f + '/')) ?? '');
  const baseParts  = baseAccess ? splitLibRel(baseAccess).rel.split('/').filter(Boolean) : [];
  for (let i = Math.max(baseParts.length - 1, 0); i < relParts.length; i++) {
    crumbs.push({ name: relParts[i], path: joinLibRel(libName, relParts.slice(0, i + 1).join('/')) });
  }

  const parent = rel === ''
    ? '' // volver a raíz global
    : rel.includes('/')
      ? joinLibRel(libName, relParts.slice(0, -1).join('/'))
      : (user.role !== 'admin' && baseAccess === libRelPath) ? '' : joinLibRel(libName, '');

  const perms = effectivePerms(user);
  res.json({
    path: libRelPath, parent, crumbs, isLibraryRoot: false,
    libraries: Object.keys(LIBRARIES),
    folders, files,
    canWrite: user.role === 'admin' || (perms.upload && rel !== ''),
  });
});

// Endpoint para listar las bibliotecas disponibles
fileRoutes.get('/libraries', (_req, res) => {
  res.json(Object.keys(LIBRARIES));
});

// ---------------------------------------------------------------------------
// Helper: extrae y valida mediaFile con soporte de prefijo de biblioteca
// ---------------------------------------------------------------------------
async function mediaFile(req: Request, kind?: 'image') {
  const rawPath = req.query.path as string | undefined;
  if (!rawPath) throw new HttpError(400, 'Falta el parámetro path');
  const libRelPath = normalizeLibRel(rawPath);
  if (!libRelPath || !canAccess(req.user!, libRelPath)) throw new HttpError(403, 'Acceso denegado');
  const { rel } = splitLibRel(libRelPath);
  const t = mediaType(rel || libRelPath);
  if (!t || (kind && t !== kind)) throw new HttpError(415, 'Tipo de archivo no soportado');
  const abs = await resolveSafe(libRelPath);
  if (!(await fs.stat(abs)).isFile()) throw new HttpError(404, 'No encontrado');
  return { libRelPath, abs };
}

// ---------------------------------------------------------------------------
// GET /thumb
// ---------------------------------------------------------------------------
fileRoutes.get('/thumb', need('view'), async (req, res) => {
  const { abs } = await mediaFile(req, 'image');
  const size: SizeKey = req.query.s === 'lg' ? 'lg' : req.query.s === 'xs' ? 'xs' : 'sm';
  let out: string;
  try { out = await getThumb(abs, size); } catch { throw new HttpError(415, 'No se pudo generar la miniatura'); }
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.sendFile(out, { cacheControl: false, dotfiles: 'allow' });
});

// ---------------------------------------------------------------------------
// GET /file
// ---------------------------------------------------------------------------
fileRoutes.get('/file', need('view'), async (req, res) => {
  const { libRelPath, abs } = await mediaFile(req);
  const download = req.query.download === '1';
  if (download && !effectivePerms(req.user!).download) throw new HttpError(403, 'No tienes permiso para descargar');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  const { rel } = splitLibRel(libRelPath);
  if (download) res.attachment(path.basename(rel));
  res.sendFile(abs, { cacheControl: false, dotfiles: 'allow' }); // sendFile soporta Range (vídeo)
});

// ---------------------------------------------------------------------------
// POST /upload
// ---------------------------------------------------------------------------
const fixName = (n: string) => {
  if (/[^\u0000-\u00ff]/.test(n)) return n;
  const d = Buffer.from(n, 'latin1').toString('utf8');
  return d.includes('\ufffd') ? n : d;
};

async function prepUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const rawPath = req.query.path as string | undefined;
    if (!rawPath) throw new HttpError(400, 'Falta el parámetro path');
    const libRelPath = normalizeLibRel(rawPath);
    const { libName, rel } = splitLibRel(libRelPath);
    if (!rel && req.user!.role !== 'admin') throw new HttpError(403, 'Elige una carpeta para subir');
    if (!canAccess(req.user!, libRelPath)) throw new HttpError(403, 'Acceso denegado');
    const dir = await resolveSafe(libRelPath);
    if (!(await fs.stat(dir)).isDirectory()) throw new HttpError(400, 'No es una carpeta');
    // tmp dentro de la misma biblioteca
    const tmpDir = path.join(libRoot(libName), TMP_NAME);
    res.locals.dir    = dir;
    res.locals.tmpDir = tmpDir;
    res.locals.skipped = [] as string[];
    next();
  } catch (e) { next(e); }
}

const uploaderFactory = (tmpDir: string) => multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, tmpDir),
    filename:    (_r, _f, cb) => cb(null, crypto.randomUUID()),
  }),
  limits:     { fileSize: config.maxUploadMb * 1024 * 1024, files: 200 },
  fileFilter: (req, file, cb) => {
    const name = fixName(file.originalname);
    if (mediaType(name)) return cb(null, true);
    (req as any).skipped = [...((req as any).skipped ?? []), name];
    cb(null, false);
  },
});

// Middleware dinámico: crea el multer con el tmpDir adecuado
async function dynamicUpload(req: Request, res: Response, next: NextFunction) {
  const tmpDir = res.locals.tmpDir as string;
  await fs.mkdir(tmpDir, { recursive: true });
  uploaderFactory(tmpDir).array('files', 200)(req, res, next);
}

fileRoutes.post('/upload', need('upload'), prepUpload, dynamicUpload, async (req, res) => {
  const dir  = res.locals.dir as string;
  const list = (req.files ?? []) as Express.Multer.File[];
  const rawMtimes = req.body?.mtimes;
  const mtimeList: (number | undefined)[] = Array.isArray(rawMtimes)
    ? rawMtimes.map((v: any) => (Number(v) && !isNaN(Number(v)) ? Number(v) : undefined))
    : rawMtimes && !isNaN(Number(rawMtimes)) ? [Number(rawMtimes)] : [];

  let uploaded = 0;
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    try {
      let name = fixName(f.originalname).replace(/[\/\\\0]/g, '_').replace(/^\.+/, '') || 'archivo';
      name = await uniqueName(dir, name);
      const dest = path.join(dir, name);
      await fs.rename(f.path, dest);

      // Usar fecha original enviada por el cliente si no hay EXIF, en lugar de la hora de subida
      const clientMtime = mtimeList[i] ?? (mtimeList.length === 1 ? mtimeList[0] : undefined);
      const fallback = (clientMtime && clientMtime > 0) ? clientMtime : Date.now();
      const isImg = mediaType(name) === 'image';

      // Extrae la fecha real de captura de metadatos EXIF / XMP / MP4
      const cdate = await getCaptureDate(dest, fallback, isImg);
      // Sincroniza la fecha en el sistema de archivos
      await syncFileMtime(dest, cdate);

      uploaded++;
    } catch { await fs.rm(f.path, { force: true }); }
  }
  res.json({ uploaded, skipped: (req as any).skipped ?? [] });
});

// ---------------------------------------------------------------------------
// POST /folders  — crear carpeta
// ---------------------------------------------------------------------------
fileRoutes.post('/folders', async (req, res) => {
  const user       = req.user!;
  const rawPath    = req.body?.path;
  const libRelPath = normalizeLibRel(rawPath ?? '');
  const { libName, rel } = splitLibRel(libRelPath);
  const name = validName(req.body?.name);
  const perms   = effectivePerms(user);
  const allowed = user.role === 'admin'
    || (perms.upload && rel !== '' && canAccess(user, libRelPath));
  if (!allowed) throw new HttpError(403, 'No tienes permiso para crear carpetas aquí');
  const parent = await resolveSafe(libRelPath);
  try { await fs.mkdir(path.join(parent, name)); }
  catch (e: any) {
    throw new HttpError(
      e.code === 'EEXIST' ? 409 : 500,
      e.code === 'EEXIST' ? 'Ya existe una carpeta con ese nombre' : 'No se pudo crear la carpeta'
    );
  }
  res.status(201).json({ path: joinLibRel(libName, rel ? `${rel}/${name}` : name) });
});

// ---------------------------------------------------------------------------
// POST /delete  — eliminar (mueve a papelera dentro de la misma biblioteca)
// ---------------------------------------------------------------------------
fileRoutes.post('/delete', need('delete'), async (req, res) => {
  const user  = req.user!;
  const paths: unknown = req.body?.paths;
  if (!Array.isArray(paths) || !paths.length || paths.length > 500) throw new HttpError(400, 'Nada que eliminar');
  let deleted = 0;
  for (const p of paths) {
    const rawLibRel = normalizeLibRel(p);
    if (!rawLibRel || !canAccess(user, rawLibRel)) continue;
    const { libName, rel } = splitLibRel(rawLibRel);
    const abs = await resolveSafe(rawLibRel).catch(() => null);
    if (!abs) continue;
    const st = await fs.stat(abs);
    if (st.isDirectory() && user.role !== 'admin') continue;
    if (st.isFile() && !mediaType(rel)) continue;
    const trash = path.join(libRoot(libName), TRASH_NAME);
    await fs.mkdir(trash, { recursive: true });
    await fs.rename(abs, path.join(trash, `${Date.now()}_${rel.replace(/\//g, '__')}`));
    deleted++;
  }
  res.json({ deleted });
});
