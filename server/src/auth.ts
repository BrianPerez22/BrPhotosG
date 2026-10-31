import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { findById, type Perms, type User } from './store';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: User } }
}

const COOKIE = 'galeria_session';
const DAY = 24 * 60 * 60 * 1000;

export function effectivePerms(u: User): Perms {
  return u.role === 'admin' ? { view: true, download: true, upload: true, delete: true } : u.perms;
}
export function publicUser(u: User) {
  return { id: u.id, username: u.username, role: u.role, perms: effectivePerms(u), folders: u.folders, createdAt: u.createdAt };
}

export function startSession(req: Request, res: Response, u: User) {
  const token = jwt.sign({ uid: u.id, v: u.tokenVersion }, config.jwtSecret, { expiresIn: '7d' });
  // "secure" solo si la petición llegó por HTTPS (p. ej. vía Cloudflare); por LAN http funciona igual
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 7 * DAY, path: '/' });
}
export const endSession = (res: Response) => { res.clearCookie(COOKIE, { path: '/' }); };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) throw new Error('no token');
    const p = jwt.verify(token, config.jwtSecret) as { uid: string; v: number };
    const u = findById(p.uid);
    if (!u || u.tokenVersion !== p.v) throw new Error('stale');
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Sesión no válida' });
  }
}
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ error: 'Solo administradores' });
}
export const need = (perm: keyof Perms) => (req: Request, res: Response, next: NextFunction) => {
  if (effectivePerms(req.user!)[perm]) return next();
  res.status(403).json({ error: 'No tienes permiso para esta acción' });
};

// IP real: detrás de cloudflared llega por loopback con CF-Connecting-IP
export function clientIp(req: Request): string {
  const peer = req.socket.remoteAddress || '';
  const loop = peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
  const cf = req.headers['cf-connecting-ip'];
  return loop && typeof cf === 'string' ? cf : req.ip || peer;
}

// Bloqueo simple de fuerza bruta: 5 fallos → 15 min (por IP+usuario) y 30 por IP
const fails = new Map<string, { n: number; until: number }>();
const LOCK = 15 * 60 * 1000;
export function isLocked(keys: string[]) {
  const now = Date.now();
  return keys.some((k) => { const f = fails.get(k); return f && f.until > now; });
}
export function registerFail(keys: [string, number][]) {
  const now = Date.now();
  for (const [k, limit] of keys) {
    const f = fails.get(k);
    const n = (f && f.until === 0 ? f.n : 0) + 1;
    fails.set(k, { n, until: n >= limit ? now + LOCK : 0 });
  }
}
export function clearFails(key: string) { fails.delete(key); }
setInterval(() => { const now = Date.now(); for (const [k, f] of fails) if (f.until && f.until < now) fails.delete(k); }, 10 * 60 * 1000).unref();
