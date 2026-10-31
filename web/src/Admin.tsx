import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { Icon } from './icons';
import { playAudioPop } from './theme';
import type { Me, Perms } from './types';

const PERM_LABELS: [keyof Perms, string][] = [
  ['view', 'Ver fotos'],
  ['download', 'Descargar'],
  ['upload', 'Subir'],
  ['delete', 'Eliminar'],
];

function depth(p: string): number {
  const rel = p.includes(':') ? p.slice(p.indexOf(':') + 1) : p;
  return rel ? rel.split('/').length : 0;
}

function folderLabel(f: string, filter: boolean): string {
  if (filter) return f;
  if (f.includes(':')) {
    const [lib, rel] = f.split(':');
    if (!rel) return lib;
    return rel.split('/').pop() ?? f;
  }
  return f.split('/').pop() ?? f;
}

function UserForm({
  user,
  folders,
  onClose,
  onSaved,
}: {
  user: Me | null;
  folders: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>(user?.role ?? 'user');
  const [perms, setPerms] = useState<Perms>(
    user?.perms ?? { view: true, download: true, upload: false, delete: false }
  );
  const [chosen, setChosen] = useState<Set<string>>(new Set(user?.folders ?? []));
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    playAudioPop('click');
    try {
      const body = {
        username,
        role,
        perms,
        folders: [...chosen],
        ...(password ? { password } : {}),
      };
      if (user) await api.updateUser(user.id, body);
      else await api.createUser({ ...body, password });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const shown = folders.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-label={user ? 'Editar usuario' : 'Nuevo usuario'}
    >
      <form
        onSubmit={submit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-white/80 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-ink-900/95 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="mb-4 flex items-center justify-between border-b border-ink-200/60 pb-3 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20 text-accent">
              <Icon name="users" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink-900 dark:text-white">
                {user ? `Editar a ${user.username}` : 'Crear nuevo usuario'}
              </h2>
              <p className="text-xs text-ink-500">Configuración de credenciales y permisos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-500">
                Nombre de usuario
              </label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-500">
                {user ? 'Nueva contraseña' : 'Contraseña inicial'}
              </label>
              <input
                className="input"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!user}
                placeholder={user ? 'Dejar en blanco para no cambiar' : ''}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-500">
              Rol del usuario
            </label>
            <select
              className="input font-medium"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
            >
              <option value="user">Usuario estándar (solo carpetas asignadas)</option>
              <option value="admin">Administrador (acceso total)</option>
            </select>
          </div>

          {role === 'user' && (
            <>
              <div>
                <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Permisos de operaciones
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PERM_LABELS.map(([k, label]) => {
                    const on = perms[k];
                    return (
                      <label
                        key={k}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-2 text-xs font-semibold transition-all select-none ${
                          on
                            ? 'border-accent bg-accent/15 text-accent dark:bg-accent/25'
                            : 'border-ink-200/80 text-ink-600 hover:bg-ink-100 dark:border-white/10 dark:text-ink-400 dark:hover:bg-ink-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-accent"
                          checked={on}
                          onChange={(e) => setPerms({ ...perms, [k]: e.target.checked })}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <legend className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Carpetas Visibles ({chosen.size})
                  </legend>
                  <span className="text-[11px] text-ink-400">Incluyen automáticamente subcarpetas</span>
                </div>

                <div className="relative mb-2">
                  <input
                    className="input h-9 pl-8 text-xs"
                    placeholder="Filtrar carpetas… (ej: Fotos:2024)"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400">
                    <Icon name="search" className="h-3.5 w-3.5" />
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-2xl border border-ink-200/80 bg-ink-50/50 p-2 dark:border-white/10 dark:bg-ink-950/40">
                  {shown.length === 0 && (
                    <p className="p-3 text-center text-xs text-ink-500">No se encontraron carpetas.</p>
                  )}
                  {shown.map((f) => (
                    <label
                      key={f}
                      className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-xs text-ink-700 hover:bg-ink-200/60 dark:text-ink-300 dark:hover:bg-ink-800/60 transition-colors"
                      style={{ paddingLeft: `${8 + (filter ? 0 : depth(f)) * 14}px` }}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-accent"
                        checked={chosen.has(f)}
                        onChange={(e) =>
                          setChosen((s) => {
                            const n = new Set(s);
                            e.target.checked ? n.add(f) : n.delete(f);
                            return n;
                          })
                        }
                      />
                      <Icon name="folder" className="h-4 w-4 text-accent shrink-0" />
                      <span className="truncate">{folderLabel(f, !!filter)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <Icon name="info" className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-ink-200/60 pt-3 dark:border-white/10">
          <button type="button" className="btn-ghost text-xs" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-solid text-xs" disabled={busy}>
            {user ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Admin({ me, onTreeChange }: { me: Me; onTreeChange: () => void }) {
  const [users, setUsers] = useState<Me[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [edit, setEdit] = useState<Me | 'new' | null>(null);
  const [msg, setMsg] = useState('');
  const [parent, setParent] = useState('');
  const [name, setName] = useState('');

  const load = () =>
    Promise.all([api.users(), api.allFolders()])
      .then(([u, f]) => {
        setUsers(u);
        setFolders(f);
      })
      .catch((e) => setMsg(e.message));

  useEffect(() => {
    load();
  }, []);

  async function remove(u: Me) {
    if (!confirm(`¿Eliminar al usuario «${u.username}»? Sus fotos no se borran.`)) return;
    playAudioPop('delete');
    try {
      await api.deleteUser(u.id);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function mkdir(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    playAudioPop('click');
    try {
      const r = await api.mkdir(parent, name.trim());
      setMsg(`Carpeta creada con éxito: ${r.path}`);
      setName('');
      load();
      onTreeChange();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const foldersByLib: Record<string, string[]> = {};
  for (const f of folders) {
    const lib = f.includes(':') ? f.split(':')[0] : '(sin biblioteca)';
    if (!foldersByLib[lib]) foldersByLib[lib] = [];
    foldersByLib[lib].push(f);
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header con estadísticas rápidas */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-ink-900 dark:text-white sm:text-3xl">
                Panel de Administración
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                Gestiona usuarios, permisos de acceso y estructura de carpetas
              </p>
            </div>
            <button
              className="btn-solid"
              onClick={() => {
                playAudioPop('click');
                setEdit('new');
              }}
            >
              <Icon name="plus" className="h-4 w-4" />
              <span>Nuevo usuario</span>
            </button>
          </div>

          {/* Tarjetas de Métricas */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Usuarios Registrados
              </span>
              <p className="mt-1 text-2xl font-black text-ink-900 dark:text-white">
                {users.length}
              </p>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Bibliotecas Activas
              </span>
              <p className="mt-1 text-2xl font-black text-accent">
                {Object.keys(foldersByLib).length}
              </p>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/70 p-4 shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Total Carpetas
              </span>
              <p className="mt-1 text-2xl font-black text-ink-900 dark:text-white">
                {folders.length}
              </p>
            </div>
          </div>
        </div>

        {msg && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-xs font-semibold text-accent backdrop-blur-md"
          >
            <Icon name="info" className="h-4 w-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        {/* Lista de Usuarios */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400">
              Cuentas de usuario ({users.length})
            </h3>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/60">
            <ul className="divide-y divide-ink-100 dark:divide-white/5">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 transition-colors hover:bg-accent/5"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent/20 to-purple-500/20 text-sm font-black text-accent uppercase">
                      {u.username.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-ink-900 dark:text-white">{u.username}</p>
                        {u.id === me.id && (
                          <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                            Tú
                          </span>
                        )}
                        <span className="rounded-md bg-ink-200/60 px-1.5 py-0.5 text-[10px] font-bold text-ink-600 dark:bg-ink-800 dark:text-ink-400">
                          {u.role === 'admin' ? 'Administrador' : 'Usuario'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {u.role === 'admin'
                          ? 'Acceso total sin restricciones'
                          : `${
                              PERM_LABELS.filter(([k]) => u.perms[k])
                                .map(([, l]) => l)
                                .join(', ') || 'Sin permisos'
                            } · ${
                              u.folders.length
                                ? `${u.folders.length} carpeta(s) asignada(s)`
                                : 'sin carpetas'
                            }`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="btn-glass text-xs h-8 px-3"
                      onClick={() => {
                        playAudioPop('click');
                        setEdit(u);
                      }}
                    >
                      <Icon name="edit" className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    {u.id !== me.id && (
                      <button
                        className="btn-danger text-xs h-8 px-2.5"
                        onClick={() => remove(u)}
                        aria-label={`Eliminar ${u.username}`}
                        title="Eliminar usuario"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Crear Carpeta en Biblioteca */}
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-400">
            Crear Carpeta en el Sistema
          </h3>
          <form
            onSubmit={mkdir}
            className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/60"
          >
            <div className="flex-1 min-w-[200px]">
              <select
                className="input text-xs font-semibold"
                value={parent}
                onChange={(e) => setParent(e.target.value)}
                aria-label="Carpeta padre"
              >
                <option value="">— Selecciona carpeta destino —</option>
                {Object.entries(foldersByLib).map(([lib, flds]) => (
                  <optgroup key={lib} label={lib}>
                    {flds.map((f) => {
                      const rel = f.includes(':') ? f.slice(f.indexOf(':') + 1) : f;
                      const indent = '\u2003'.repeat(rel ? rel.split('/').length - 1 : 0);
                      return (
                        <option key={f} value={f}>
                          {indent}
                          {f.split('/').pop() ?? f}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                className="input text-xs font-medium"
                placeholder="Nombre de la nueva carpeta"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-solid text-xs h-10 px-5">
              <Icon name="plus" className="h-4 w-4" />
              <span>Crear carpeta</span>
            </button>
          </form>
        </section>
      </div>

      {edit && (
        <UserForm
          user={edit === 'new' ? null : edit}
          folders={folders}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
    </div>
  );
}
