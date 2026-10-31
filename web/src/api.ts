import type { FileEntry, Listing, Me, UserInput } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function req<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers;
  const res = await fetch(url, { ...init, headers, credentials: 'same-origin' });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error ?? msg; } catch { /* sin cuerpo */ }
    if (res.status === 401 && !url.includes('/auth/')) window.dispatchEvent(new Event('unauthorized'));
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  me: () => req<Me>('/api/auth/me'),
  login: (username: string, password: string) => req<Me>('/api/auth/login', post({ username, password })),
  logout: () => req<void>('/api/auth/logout', { method: 'POST' }),
  changePassword: (current: string, next: string) => req<void>('/api/auth/password', post({ current, next })),
  browse: (path: string) => req<Listing>('/api/browse?path=' + encodeURIComponent(path)),
  mkdir: (path: string, name: string) => req<{ path: string }>('/api/folders', post({ path, name })),
  remove: (paths: string[]) => req<{ deleted: number }>('/api/delete', post({ paths })),
  users: () => req<Me[]>('/api/admin/users'),
  createUser: (u: UserInput) => req<Me>('/api/admin/users', post(u)),
  updateUser: (id: string, u: UserInput) => req<Me>('/api/admin/users/' + id, { method: 'PATCH', body: JSON.stringify(u) }),
  deleteUser: (id: string) => req<void>('/api/admin/users/' + id, { method: 'DELETE' }),
  allFolders: () => req<string[]>('/api/admin/folders'),
  transfer: (paths: string[], dest: string, mode: 'move' | 'copy') =>
    req<{ done: number; skipped: number }>('/api/transfer', post({ paths, dest, mode })),
};

export const thumbUrl = (path: string, size: 'xs' | 'sm' | 'lg' = 'sm') => `/api/thumb?s=${size}&path=${encodeURIComponent(path)}`;
export const fileUrl = (path: string, download = false) => `/api/file?path=${encodeURIComponent(path)}${download ? '&download=1' : ''}`;

export function uploadFiles(path: string, files: File[], onProgress: (loaded: number) => void) {
  return new Promise<{ uploaded: number; skipped: string[] }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload?path=' + encodeURIComponent(path));
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onerror = () => reject(new ApiError(0, 'Error de red al subir'));
    xhr.onload = () => {
      let body: any = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* ignorar */ }
      if (xhr.status < 300) resolve(body);
      else reject(new ApiError(xhr.status, body.error ?? (xhr.status === 413 ? 'Archivo demasiado grande' : 'No se pudo subir')));
    };
    const fd = new FormData();
    files.forEach((f) => {
      fd.append('files', f);
      fd.append('mtimes', String(f.lastModified || Date.now()));
    });
    xhr.send(fd);
  });
}

export const isGif = (f: Pick<FileEntry, 'name'>) => /\.gif$/i.test(f.name);
export function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
