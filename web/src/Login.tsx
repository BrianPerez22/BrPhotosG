import { useState, type FormEvent } from 'react';
import { api } from './api';
import { Icon } from './icons';
import MagicOrb from './MagicOrb';
import AmbientAura from './AmbientAura';
import { playAudioPop } from './theme';
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
    playAudioPop('click');
    try {
      const me = await api.login(username, password);
      onLogin(me);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 selection:bg-accent selection:text-white">
      <AmbientAura />

      {/* Bolita flotante en la esquina para personalizar tema */}
      <div className="absolute top-5 right-5">
        <MagicOrb />
      </div>

      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        {/* Resplandor de fondo detrás de la tarjeta */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-accent via-purple-500 to-pink-500 opacity-20 blur-xl dark:opacity-30" />

        {/* Tarjeta de Login Glassmórfica */}
        <form
          onSubmit={submit}
          className="relative rounded-3xl border border-white/80 bg-white/80 p-8 shadow-2xl backdrop-blur-2xl transition-all dark:border-white/10 dark:bg-ink-900/80"
        >
          {/* Header con icono y tipografía moderna */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent to-accent-glow text-white shadow-xl shadow-accent/30 animate-bounce-subtle">
              <Icon name="camera" className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-ink-900 dark:text-white sm:text-3xl">
              Galería
            </h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              Inicia sesión para explorar tus recuerdos
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-center gap-2.5 rounded-2xl border border-rose-500/20 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 backdrop-blur-md dark:bg-rose-950/40 dark:text-rose-300"
            >
              <Icon name="info" className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Campo Usuario */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                Usuario
              </label>
              <div className="relative">
                <input
                  className="input pl-10"
                  placeholder="Tu nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
                  <Icon name="users" className="h-4 w-4" />
                </span>
              </div>
            </div>

            {/* Campo Contraseña con botón Ver/Ocultar */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                Contraseña
              </label>
              <div className="relative">
                <input
                  className="input pl-10 pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
                  <Icon name="key" className="h-4 w-4" />
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Botón de inicio de sesión con gradiente y animación */}
            <button
              type="submit"
              disabled={busy}
              className="btn-solid mt-2 h-11 w-full text-base font-semibold shadow-lg shadow-accent/30 hover:scale-[1.01] active:scale-[0.98]"
            >
              {busy ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Accediendo…</span>
                </div>
              ) : (
                <span>Entrar a la galería</span>
              )}
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-ink-400">
            Haz clic en la bolita de arriba para cambiar el ambiente visual ✨
          </div>
        </form>
      </div>
    </div>
  );
}
