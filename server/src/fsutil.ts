import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { config } from './config';
import type { User } from './store';

export const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp']);
export const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v']);
export const mediaType = (name: string): 'image' | 'video' | null => {
  const e = path.extname(name).toLowerCase();
  return IMAGE_EXT.has(e) ? 'image' : VIDEO_EXT.has(e) ? 'video' : null;
};

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ---------------------------------------------------------------------------
// Multibiblioteca
// ---------------------------------------------------------------------------

/** Mapa nombre → realpath de cada biblioteca. Se rellena en initLibraries(). */
export const LIBRARIES: Record<string, string> = {};

/** Primera biblioteca (compatibilidad con REAL_ROOT legacy). */
export let REAL_ROOT = '';

export const TRASH_NAME = '.papelera';
export const TMP_NAME   = '.subidas-tmp';

export function initRoot() { initLibraries(); }

export function initLibraries() {
  const libs = config.libraries;
  const names = Object.keys(libs);
  if (names.length === 0) throw new Error('No hay bibliotecas configuradas en LIBRARIES ni en PHOTOS_ROOT');

  for (const name of names) {
    const dir = libs[name];
    if (!fsSync.existsSync(dir)) throw new Error(`Biblioteca «${name}» no existe: ${dir}`);
    const real = fsSync.realpathSync(dir);
    LIBRARIES[name] = real;
    fsSync.mkdirSync(path.join(real, TMP_NAME),  { recursive: true });
    fsSync.mkdirSync(path.join(real, TRASH_NAME), { recursive: true });
  }

  // Compat: REAL_ROOT = primera biblioteca
  REAL_ROOT = LIBRARIES[names[0]];

  fsSync.mkdirSync(path.join(config.dataDir, 'thumbs'), { recursive: true });
}

// ---------------------------------------------------------------------------
// Rutas: formato "LibName:rel/path"  (":": separador biblioteca/ruta)
// ---------------------------------------------------------------------------

const SEP = ':';

/** Devuelve { libName, rel } a partir de un path prefijado tipo "Fotos:2024/enero".
 *  Si no hay prefijo (legado) usa la primera biblioteca. */
export function splitLibRel(raw: string): { libName: string; rel: string } {
  const idx = raw.indexOf(SEP);
  if (idx > 0) {
    const libName = raw.slice(0, idx);
    const rel     = raw.slice(idx + 1);
    return { libName, rel };
  }
  // Sin prefijo → primera biblioteca (compat)
  const libName = Object.keys(LIBRARIES)[0] ?? '';
  return { libName, rel: raw };
}

/** Construye un "full path" para la API: "LibName:rel/path" */
export function joinLibRel(libName: string, rel: string): string {
  return rel ? `${libName}${SEP}${rel}` : `${libName}${SEP}`;
}

/** Obtiene la raíz real de una biblioteca por nombre. Lanza 404 si no existe. */
export function libRoot(libName: string): string {
  const r = LIBRARIES[libName];
  if (!r) throw new HttpError(404, `Biblioteca «${libName}» no encontrada`);
  return r;
}

// ---------------------------------------------------------------------------
// Normalización y resolución segura
// ---------------------------------------------------------------------------

/** Normaliza un segmento relativo (sin prefijo de biblioteca): sin "..", sin ocultos */
export function normalizeRel(input: unknown): string {
  if (input === undefined || input === null || input === '') return '';
  if (typeof input !== 'string' || input.includes('\0') || input.length > 2000) throw new HttpError(400, 'Ruta inválida');
  // Quitar el prefijo de biblioteca si lo trae (para llamadas que solo necesitan el rel)
  const stripped = input.includes(SEP) ? input.slice(input.indexOf(SEP) + 1) : input;
  const parts = stripped.split('/').filter((p) => p && p !== '.');
  for (const p of parts) if (p === '..' || p.startsWith('.')) throw new HttpError(400, 'Ruta inválida');
  return parts.join('/');
}

/** Igual que normalizeRel pero conserva el prefijo de biblioteca. */
export function normalizeLibRel(input: unknown): string {
  if (input === undefined || input === null || input === '') return '';
  if (typeof input !== 'string' || input.includes('\0') || input.length > 2000) throw new HttpError(400, 'Ruta inválida');
  const { libName, rel } = splitLibRel(input);
  if (libName && !LIBRARIES[libName]) throw new HttpError(404, `Biblioteca «${libName}» no encontrada`);
  const parts = rel.split('/').filter((p) => p && p !== '.');
  for (const p of parts) if (p === '..' || p.startsWith('.')) throw new HttpError(400, 'Ruta inválida');
  const cleanRel = parts.join('/');
  return libName ? `${libName}${SEP}${cleanRel}` : cleanRel;
}

/** Resuelve un "LibName:rel" a su ruta absoluta real, comprobando que no escapa. */
export async function resolveSafe(libRelPath: string): Promise<string> {
  const { libName, rel } = splitLibRel(libRelPath);
  const root = libRoot(libName);
  const abs  = path.join(root, ...rel.split('/').filter(Boolean));
  let real: string;
  try { real = await fs.realpath(abs); } catch { throw new HttpError(404, 'No encontrado'); }
  if (real !== root && !real.startsWith(root + path.sep)) throw new HttpError(403, 'Acceso denegado');
  return real;
}

// ---------------------------------------------------------------------------
// Control de acceso
// ---------------------------------------------------------------------------

/** Devuelve true si el usuario puede acceder a la ruta completa "LibName:rel". */
export function canAccess(user: User, libRelPath: string): boolean {
  if (user.role === 'admin') return true;
  return user.folders.some((f) => libRelPath === f || libRelPath.startsWith(f + '/'));
}

/** Devuelve el folder-root que da acceso a libRelPath, o null si ninguno. */
export function accessRoot(user: User, libRelPath: string): string | null {
  if (user.role === 'admin') return '';
  const m = user.folders
    .filter((f) => libRelPath === f || libRelPath.startsWith(f + '/'))
    .sort((a, b) => b.length - a.length);
  return m[0] ?? null;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export function validName(raw: unknown): string {
  if (typeof raw !== 'string') throw new HttpError(400, 'Nombre inválido');
  const n = raw.trim();
  // eslint-disable-next-line no-control-regex
  if (!n || n.length > 120 || /[\/\\\x00-\x1f]/.test(n) || n === '.' || n === '..' || n.startsWith('.'))
    throw new HttpError(400, 'Nombre inválido (sin "/" ni punto inicial)');
  return n;
}

export async function uniqueName(dir: string, name: string): Promise<string> {
  const ext  = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let candidate = name;
  for (let i = 1; ; i++) {
    try { await fs.access(path.join(dir, candidate)); candidate = `${base} (${i})${ext}`; }
    catch { return candidate; }
  }
}
