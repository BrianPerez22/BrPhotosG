import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { config } from './config';

sharp.cache({ memory: 64, files: 0, items: 50 });
sharp.concurrency(2);

export const SIZES = { xs: 320, sm: 480, md: 1280, lg: 1800 } as const;
export type SizeKey = keyof typeof SIZES;

// Máximo 2 miniaturas pequeñas a la vez (el servidor tiene poca RAM).
// Las fotos grandes (md/lg) son las que el usuario abrió: pasan por delante de
// la cola de miniaturas y pueden usar un hueco extra.
const MAX = 2;
let active = 0;
const urgentQ: (() => void)[] = [];
const normalQ: (() => void)[] = [];
function next() {
  if (active < MAX + 1 && urgentQ.length) urgentQ.shift()!();
  else if (active < MAX && normalQ.length) normalQ.shift()!();
}
async function slot<T>(fn: () => Promise<T>, urgent: boolean): Promise<T> {
  if (active >= (urgent ? MAX + 1 : MAX)) await new Promise<void>((r) => (urgent ? urgentQ : normalQ).push(r));
  active++;
  try { return await fn(); } finally { active--; next(); }
}

const inflight = new Map<string, Promise<string>>();

export async function getThumb(abs: string, size: SizeKey): Promise<string> {
  const st = await fs.stat(abs);
  const key = crypto.createHash('sha1').update(`${abs}|${st.mtimeMs}|${st.size}|${size}`).digest('hex');
  const out = path.join(config.dataDir, 'thumbs', `${key}.webp`);
  try { await fs.access(out); return out; } catch { /* generar */ }
  let p = inflight.get(out);
  if (!p) {
    p = slot(async () => {
      const tmp = `${out}.${process.pid}.tmp`;
      await sharp(abs, { failOn: 'none', limitInputPixels: 268402689 })
        .rotate()
        .resize({ width: SIZES[size], height: SIZES[size], fit: 'inside', withoutEnlargement: true })
        .webp({ quality: size === 'xs' || size === 'sm' ? 72 : 82 })
        .toFile(tmp);
      await fs.rename(tmp, out);
      return out;
    }, size === 'md' || size === 'lg').finally(() => inflight.delete(out));
    inflight.set(out, p);
  }
  return p;
}
