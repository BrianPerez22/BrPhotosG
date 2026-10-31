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

export let REAL_ROOT = '';
export const TRASH_NAME = '.papelera';
export const TMP_NAME = '.subidas-tmp';

export function initRoot() {
  if (!fsSync.existsSync(config.photosRoot)) throw new Error(`PHOTOS_ROOT no existe: ${config.photosRoot}`);
  REAL_ROOT = fsSync.realpathSync(config.photosRoot);
  fsSync.mkdirSync(path.join(REAL_ROOT, TMP_NAME), { recursive: true });
  fsSync.mkdirSync(path.join(config.dataDir, 'thumbs'), { recursive: true });
}

// Ruta relativa segura ("a/b"), sin "..", sin segmentos ocultos
export function normalizeRel(input: unknown): string {
  if (input === undefined || input === null || input === '') return '';
  if (typeof input !== 'string' || input.includes('\0') || input.length > 1000) throw new HttpError(400, 'Ruta inválida');
  const parts = input.split('/').filter((p) => p && p !== '.');
  for (const p of parts) if (p === '..' || p.startsWith('.')) throw new HttpError(400, 'Ruta inválida');
  return parts.join('/');
}

// Resuelve y comprueba (con realpath) que no se escapa de la raíz, ni por enlaces simbólicos
export async function resolveSafe(rel: string): Promise<string> {
  const abs = path.join(REAL_ROOT, ...rel.split('/').filter(Boolean));
  let real: string;
  try { real = await fs.realpath(abs); } catch { throw new HttpError(404, 'No encontrado'); }
  if (real !== REAL_ROOT && !real.startsWith(REAL_ROOT + path.sep)) throw new HttpError(403, 'Acceso denegado');
  return real;
}

export function canAccess(user: User, rel: string): boolean {
  if (user.role === 'admin') return true;
  return user.folders.some((f) => rel === f || rel.startsWith(f + '/'));
}
export function accessRoot(user: User, rel: string): string | null {
  if (user.role === 'admin') return '';
  const m = user.folders.filter((f) => rel === f || rel.startsWith(f + '/')).sort((a, b) => b.length - a.length);
  return m[0] ?? null;
}

export function validName(raw: unknown): string {
  if (typeof raw !== 'string') throw new HttpError(400, 'Nombre inválido');
  const n = raw.trim();
  // eslint-disable-next-line no-control-regex
  if (!n || n.length > 120 || /[\/\\\x00-\x1f]/.test(n) || n === '.' || n === '..' || n.startsWith('.'))
    throw new HttpError(400, 'Nombre inválido (sin "/" ni punto inicial)');
  return n;
}

export async function uniqueName(dir: string, name: string): Promise<string> {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let candidate = name;
  for (let i = 1; ; i++) {
    try { await fs.access(path.join(dir, candidate)); candidate = `${base} (${i})${ext}`; }
    catch { return candidate; }
  }
}
