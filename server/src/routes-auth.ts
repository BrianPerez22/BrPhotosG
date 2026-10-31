import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { clearFails, clientIp, endSession, isLocked, publicUser, registerFail, requireAuth, startSession } from './auth';
import { HttpError } from './fsutil';
import { findByName, saveUsers } from './store';

export const authRoutes = Router();
const DUMMY = bcrypt.hashSync('dummy-password', 10);

authRoutes.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') throw new HttpError(400, 'Faltan datos');
  const ip = clientIp(req);
  const keyUser = `u:${ip}|${username.toLowerCase()}`;
  const keyIp = `i:${ip}`;
  if (isLocked([keyUser, keyIp])) throw new HttpError(429, 'Demasiados intentos. Espera unos minutos.');
  const user = findByName(username.trim());
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY);
  if (!user || !ok) {
    registerFail([[keyUser, 5], [keyIp, 30]]);
    throw new HttpError(401, 'Usuario o contraseña incorrectos');
  }
  clearFails(keyUser);
  startSession(req, res, user);
  res.json(publicUser(user));
});

authRoutes.post('/logout', (_req, res) => { endSession(res); res.status(204).end(); });

authRoutes.get('/me', requireAuth, (req, res) => { res.json(publicUser(req.user!)); });

authRoutes.post('/password', requireAuth, async (req, res) => {
  const { current, next } = req.body ?? {};
  const u = req.user!;
  if (typeof current !== 'string' || typeof next !== 'string' || next.length < 4) throw new HttpError(400, 'La nueva contraseña debe tener al menos 4 caracteres');
  if (!(await bcrypt.compare(current, u.passwordHash))) throw new HttpError(401, 'La contraseña actual no es correcta');
  u.passwordHash = await bcrypt.hash(next, 10);
  u.tokenVersion++;
  saveUsers();
  startSession(req, res, u);
  res.status(204).end();
});
