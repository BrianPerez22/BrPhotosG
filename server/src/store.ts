import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config';

export interface Perms { view: boolean; download: boolean; upload: boolean; delete: boolean }
export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  perms: Perms;
  folders: string[]; // rutas relativas a PHOTOS_ROOT visibles para este usuario
  createdAt: string;
  tokenVersion: number;
}

const file = path.join(config.dataDir, 'users.json');
let users: User[] = [];

export function loadUsers() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  if (fs.existsSync(file)) users = JSON.parse(fs.readFileSync(file, 'utf8'));
}
export function saveUsers() {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
export const listUsers = () => users;
export const findById = (id: string) => users.find((u) => u.id === id);
export const findByName = (n: string) => users.find((u) => u.username.toLowerCase() === n.toLowerCase());
export const newId = () => crypto.randomUUID();
export function addUser(u: User) { users.push(u); saveUsers(); }
export function removeUser(id: string) { users = users.filter((u) => u.id !== id); saveUsers(); }
