import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { config } from './config';

sharp.cache({ memory: 64, files: 0, items: 50 });
sharp.concurrency(2);

export const SIZES = { xs: 320, sm: 480, lg: 1800 } as const;
export type SizeKey = keyof typeof SIZES;

// Máximo 2 miniaturas generándose a la vez (el servidor tiene poca RAM)
let active = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((r) => waiting.push(r));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
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
        .webp({ quality: size === 'lg' ? 82 : 72 })
        .toFile(tmp);
      await fs.rename(tmp, out);
      return out;
    }).finally(() => inflight.delete(out));
    inflight.set(out, p);
  }
  return p;
}
