import { Router } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { publicUser, requireAdmin, requireAuth } from './auth';
import { HttpError, LIBRARIES, normalizeLibRel, resolveSafe, splitLibRel, joinLibRel } from './fsutil';
import { addUser, findById, findByName, listUsers, newId, removeUser, saveUsers, type Perms, type User } from './store';

export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireAdmin);

const NAME_RE = /^[\p{L}\p{N}_.-]{2,32}$/u;

function cleanPerms(p: any, fallback: Perms): Perms {
  const b = (k: keyof Perms) => (typeof p?.[k] === 'boolean' ? p[k] : fallback[k]);
  return { view: b('view'), download: b('download'), upload: b('upload'), delete: b('delete') };
}

/**
 * Valida y limpia un array de rutas "LibName:rel" proporcionadas por el admin.
 * Verifica que cada una exista y sea directorio.
 */
async function cleanFolders(list: unknown): Promise<string[]> {
  if (!Array.isArray(list)) throw new HttpError(400, 'Carpetas inválidas');
  const out = new Set<string>();
  for (const f of list) {
    const libRelPath = normalizeLibRel(f);
    if (!libRelPath) continue;
    const { libName, rel } = splitLibRel(libRelPath);
    if (!LIBRARIES[libName]) throw new HttpError(400, `Biblioteca desconocida: ${libName}`);
    if (!rel) throw new HttpError(400, `Debes especificar una subcarpeta dentro de «${libName}», no la raíz`);
    const abs = await resolveSafe(libRelPath);
    if (!(await fs.stat(abs)).isDirectory()) throw new HttpError(400, `No es una carpeta: ${libRelPath}`);
    out.add(libRelPath);
  }
  return [...out];
}

const adminCount = () => listUsers().filter((u) => u.role === 'admin').length;

adminRoutes.get('/users', (_req, res) => { res.json(listUsers().map(publicUser)); });

adminRoutes.post('/users', async (req, res) => {
  const b = req.body ?? {};
  if (typeof b.username !== 'string' || !NAME_RE.test(b.username.trim())) throw new HttpError(400, 'Usuario: 2-32 caracteres (letras, números, . _ -)');
  if (typeof b.password !== 'string' || b.password.length < 4) throw new HttpError(400, 'La contraseña debe tener al menos 4 caracteres');
  if (findByName(b.username.trim())) throw new HttpError(409, 'Ese usuario ya existe');
  const user: User = {
    id: newId(),
    username: b.username.trim(),
    passwordHash: await bcrypt.hash(b.password, 10),
    role: b.role === 'admin' ? 'admin' : 'user',
    perms: cleanPerms(b.perms, { view: true, download: false, upload: false, delete: false }),
    folders: await cleanFolders(b.folders ?? []),
    createdAt: new Date().toISOString(),
    tokenVersion: 1,
  };
  addUser(user);
  res.status(201).json(publicUser(user));
});

adminRoutes.patch('/users/:id', async (req, res) => {
  const u = findById(String(req.params.id));
  if (!u) throw new HttpError(404, 'Usuario no encontrado');
  const b = req.body ?? {};
  if (b.username !== undefined) {
    if (typeof b.username !== 'string' || !NAME_RE.test(b.username.trim())) throw new HttpError(400, 'Nombre de usuario inválido');
    const other = findByName(b.username.trim());
    if (other && other.id !== u.id) throw new HttpError(409, 'Ese usuario ya existe');
    u.username = b.username.trim();
  }
  if (b.role !== undefined) {
    const role = b.role === 'admin' ? 'admin' : 'user';
    if (u.role === 'admin' && role !== 'admin' && adminCount() <= 1) throw new HttpError(400, 'Debe quedar al menos un administrador');
    if (role !== u.role) { u.role = role; u.tokenVersion++; }
  }
  if (b.perms !== undefined) u.perms = cleanPerms(b.perms, u.perms);
  if (b.folders !== undefined) u.folders = await cleanFolders(b.folders);
  if (b.password) {
    if (typeof b.password !== 'string' || b.password.length < 4) throw new HttpError(400, 'La contraseña debe tener al menos 4 caracteres');
    u.passwordHash = await bcrypt.hash(b.password, 10);
    u.tokenVersion++;
  }
  saveUsers();
  res.json(publicUser(u));
});

adminRoutes.delete('/users/:id', (req, res) => {
  const u = findById(String(req.params.id));
  if (!u) throw new HttpError(404, 'Usuario no encontrado');
  if (u.id === req.user!.id) throw new HttpError(400, 'No puedes eliminar tu propio usuario');
  if (u.role === 'admin' && adminCount() <= 1) throw new HttpError(400, 'Debe quedar al menos un administrador');
  removeUser(u.id);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Lista plana de carpetas de TODAS las bibliotecas (hasta 4 niveles)
// para el selector de carpetas del panel de administración
// ---------------------------------------------------------------------------
adminRoutes.get('/folders', async (_req, res) => {
  const out: string[] = [];
  async function walk(libName: string, rel: string, depth: number) {
    if (depth > 4 || out.length > 3000) return;
    const abs = path.join(LIBRARIES[libName], ...rel.split('/').filter(Boolean));
    const entries = await fs.readdir(abs, { withFileTypes: true }).catch(() => []);
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    for (const d of dirs) {
      const childRel = rel ? `${rel}/${d}` : d;
      const libRelPath = joinLibRel(libName, childRel);
      out.push(libRelPath);
      await walk(libName, childRel, depth + 1);
    }
  }
  for (const libName of Object.keys(LIBRARIES)) {
    await walk(libName, '', 1);
  }
  res.json(out);
});
