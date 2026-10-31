import { useState, type FormEvent } from 'react';
import { api } from './api';
import { Icon } from './icons';
import type { Me } from './types';

export default function Login({ onLogin }: { onLogin: (m: Me) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try { onLogin(await api.login(username, password)); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex h-full items-center justify-center bg-ink-50 px-4 dark:bg-ink-950">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white dark:bg-accent-dark dark:text-ink-950"><Icon name="photo" /></span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Fotos</h1>
            <p className="text-sm text-ink-500">Inicia sesión para ver tus álbumes</p>
          </div>
        </div>
        <label className="mb-1 block text-sm font-medium">Usuario</label>
        <input className="input mb-4" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        <label className="mb-1 block text-sm font-medium">Contraseña</label>
        <input className="input mb-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <button className="btn-solid h-10 w-full justify-center" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
