import { useState, type FormEvent } from 'react';
import { api } from './api';
import { Icon } from './icons';
import ThemeOrb from './ThemeOrb';
import type { Me } from './types';

export default function Login({ onLogin }: { onLogin: (m: Me) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api.login(username, password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeOrb />
      </div>

      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white">
            <Icon name="camera" className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Galería</h1>
          <p className="mt-1 text-sm text-muted">Inicia sesión para ver tus fotos</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400">
            <Icon name="info" className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">Usuario</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">Contraseña</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn-solid h-11 w-full text-base">
            {busy ? 'Accediendo…' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
