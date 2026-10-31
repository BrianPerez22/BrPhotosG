import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { effectivePerms } from './auth';
import { canAccess, HttpError, mediaType, normalizeLibRel, resolveSafe, splitLibRel, uniqueName } from './fsutil';

export const transferRoutes = Router();

async function copyOne(src: string, dst: string, isDir: boolean) {
  if (isDir) {
    await fs.cp(src, dst, {
      recursive: true,
      preserveTimestamps: true,
      filter: (s) => !path.basename(s).startsWith('.'),
    });
  } else {
    await fs.copyFile(src, dst);
    const st = await fs.stat(src);
    await fs.utimes(dst, st.atime, st.mtime); // conserva la fecha original
  }
}

// POST /transfer  { paths: string[], dest: "Lib:ruta", mode: 'move' | 'copy' }
//  - copiar exige permiso «subir»; mover exige «subir» + «eliminar»
//  - solo el administrador puede mover/copiar carpetas enteras
transferRoutes.post('/transfer', async (req, res) => {
  const user = req.user!;
  const isAdmin = user.role === 'admin';
  const perms = effectivePerms(user);
  const mode = req.body?.mode === 'move' ? 'move' : 'copy';
  const paths: unknown = req.body?.paths;
  if (!Array.isArray(paths) || !paths.length || paths.length > 500) throw new HttpError(400, 'Nada que mover o copiar');

  const destLib = normalizeLibRel(req.body?.dest ?? '');
  const destRel = destLib ? splitLibRel(destLib).rel : '';
  if (!destLib || (!isAdmin && !destRel)) throw new HttpError(400, 'Elige una carpeta de destino');
  if (!isAdmin && (!perms.upload || (mode === 'move' && !perms.delete))) throw new HttpError(403, 'No tienes permiso para esta acción');
  if (!canAccess(user, destLib)) throw new HttpError(403, 'Acceso denegado al destino');

  const destAbs = await resolveSafe(destLib);
  if (!(await fs.stat(destAbs)).isDirectory()) throw new HttpError(400, 'El destino no es una carpeta');

  let done = 0;
  let skipped = 0;
  for (const p of paths) {
    try {
      const src = normalizeLibRel(p);
      const rel = src ? splitLibRel(src).rel : '';
      if (!rel || !canAccess(user, src)) { skipped++; continue; }
      const srcAbs = await resolveSafe(src);
      const st = await fs.stat(srcAbs);
      const isDir = st.isDirectory();
      if (isDir && !isAdmin) { skipped++; continue; }
      if (!isDir && !mediaType(rel)) { skipped++; continue; }
      if (isDir && (destAbs === srcAbs || destAbs.startsWith(srcAbs + path.sep))) { skipped++; continue; }
      if (mode === 'move' && path.dirname(srcAbs) === destAbs) { skipped++; continue; }

      const dst = path.join(destAbs, await uniqueName(destAbs, path.basename(srcAbs)));
      if (mode === 'copy') {
        await copyOne(srcAbs, dst, isDir);
      } else {
        try {
          await fs.rename(srcAbs, dst);
        } catch (e: any) {
          if (e?.code !== 'EXDEV') throw e; // otra unidad: copiar y borrar
          await copyOne(srcAbs, dst, isDir);
          await fs.rm(srcAbs, { recursive: true, force: true });
        }
      }
      done++;
    } catch {
      skipped++;
    }
  }
  res.json({ done, skipped });
});
