import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { Icon } from './icons';
import type { Me, Perms } from './types';

const PERM_LABELS: [keyof Perms, string][] = [['view', 'Ver'], ['download', 'Descargar'], ['upload', 'Subir'], ['delete', 'Eliminar']];
const depth = (p: string) => p.split('/').length - 1;

function UserForm({ user, folders, onClose, onSaved }: { user: Me | null; folders: string[]; onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>(user?.role ?? 'user');
  const [perms, setPerms] = useState<Perms>(user?.perms ?? { view: true, download: true, upload: false, delete: false });
  const [chosen, setChosen] = useState<Set<string>>(new Set(user?.folders ?? []));
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const body = { username, role, perms, folders: [...chosen], ...(password ? { password } : {}) };
      if (user) await api.updateUser(user.id, body); else await api.createUser({ ...body, password });
      onSaved();
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }
  const shown = folders.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label={user ? 'Editar usuario' : 'Nuevo usuario'}>
      <form onSubmit={submit} className="flex max-h-full w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl dark:bg-ink-900">
        <h2 className="mb-4 text-lg font-semibold">{user ? `Editar a ${user.username}` : 'Nuevo usuario'}</h2>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-sm font-medium">Usuario</label><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="off" /></div>
            <div><label className="mb-1 block text-sm font-medium">{user ? 'Nueva contraseña' : 'Contraseña'}</label>
              <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required={!user} placeholder={user ? 'Dejar vacío para no cambiar' : ''} autoComplete="off" /></div>
          </div>
          <div><label className="mb-1 block text-sm font-medium">Rol</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'user')}>
              <option value="user">Usuario (solo las carpetas asignadas)</option><option value="admin">Administrador (todo)</option>
            </select></div>
          {role === 'user' && (<>
            <fieldset><legend className="mb-1 text-sm font-medium">Permisos</legend>
              <div className="flex flex-wrap gap-2">
                {PERM_LABELS.map(([k, label]) => (
                  <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${perms[k] ? 'border-accent bg-accent-soft/60 dark:border-accent-dark dark:bg-accent/20' : 'border-ink-200 dark:border-ink-700'}`}>
                    <input type="checkbox" className="accent-accent" checked={perms[k]} onChange={(e) => setPerms({ ...perms, [k]: e.target.checked })} />{label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset><legend className="mb-1 text-sm font-medium">Carpetas visibles <span className="font-normal text-ink-500">({chosen.size}) · incluyen sus subcarpetas</span></legend>
              <input className="input mb-2" placeholder="Buscar carpeta…" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <div className="max-h-48 overflow-y-auto rounded-lg border border-ink-200 p-1 dark:border-ink-700">
                {shown.length === 0 && <p className="p-2 text-sm text-ink-500">No hay carpetas.</p>}
                {shown.map((f) => (
                  <label key={f} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-ink-100 dark:hover:bg-ink-800" style={{ paddingLeft: `${8 + (filter ? 0 : depth(f)) * 16}px` }}>
                    <input type="checkbox" className="accent-accent" checked={chosen.has(f)} onChange={(e) => setChosen((s) => { const n = new Set(s); e.target.checked ? n.add(f) : n.delete(f); return n; })} />
                    <Icon name="folder" className="h-4 w-4 text-ink-400" /><span className="truncate">{filter ? f : f.split('/').pop()}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>)}
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-solid" disabled={busy}>{user ? 'Guardar cambios' : 'Crear usuario'}</button>
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

  const load = () => Promise.all([api.users(), api.allFolders()]).then(([u, f]) => { setUsers(u); setFolders(f); }).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);

  async function remove(u: Me) {
    if (!confirm(`¿Eliminar al usuario «${u.username}»? Sus fotos no se borran.`)) return;
    try { await api.deleteUser(u.id); load(); } catch (e) { setMsg((e as Error).message); }
  }
  async function mkdir(e: FormEvent) {
    e.preventDefault();
    try { const r = await api.mkdir(parent, name.trim()); setMsg(`Carpeta creada: ${r.path}`); setName(''); load(); onTreeChange(); }
    catch (err) { setMsg((err as Error).message); }
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-6 md:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">Administración</h2>
          <button className="btn-solid" onClick={() => setEdit('new')}><Icon name="plus" className="h-4 w-4" />Nuevo usuario</button>
        </div>
        {msg && <p role="status" className="mb-4 rounded-lg bg-ink-100 px-3 py-2 text-sm dark:bg-ink-800">{msg}</p>}

        <h3 className="mb-2 text-sm font-medium text-ink-500">Usuarios</h3>
        <ul className="mb-10 divide-y divide-ink-100 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{u.username}{u.id === me.id && <span className="ml-2 text-xs font-normal text-ink-500">(tú)</span>}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {u.role === 'admin' ? 'Administrador · acceso total' : `${PERM_LABELS.filter(([k]) => u.perms[k]).map(([, l]) => l).join(', ') || 'Sin permisos'} · ${u.folders.length ? u.folders.join(', ') : 'sin carpetas asignadas'}`}
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setEdit(u)}><Icon name="edit" className="h-4 w-4" />Editar</button>
              {u.id !== me.id && <button className="btn-danger" onClick={() => remove(u)} aria-label={`Eliminar ${u.username}`}><Icon name="trash" className="h-4 w-4" /></button>}
            </li>
          ))}
        </ul>

        <h3 className="mb-2 text-sm font-medium text-ink-500">Crear carpeta</h3>
        <form onSubmit={mkdir} className="flex flex-wrap gap-2">
          <select className="input w-auto min-w-40 flex-1" value={parent} onChange={(e) => setParent(e.target.value)} aria-label="Dentro de">
            <option value="">Fotos (raíz)</option>
            {folders.map((f) => <option key={f} value={f}>{'\u2003'.repeat(depth(f))}{f.split('/').pop()}</option>)}
          </select>
          <input className="input w-auto min-w-40 flex-1" placeholder="Nombre de la carpeta" value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="btn-solid h-10">Crear</button>
        </form>
      </div>
      {edit && <UserForm user={edit === 'new' ? null : edit} folders={folders} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}
