import { toggleTheme, useMode } from './theme';
import { Icon } from './icons';

/** La bolita: un solo clic alterna entre modo claro y oscuro. Nada más. */
export default function ThemeOrb() {
  const mode = useMode();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white"
    >
      <Icon name={mode === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
    </button>
  );
}
