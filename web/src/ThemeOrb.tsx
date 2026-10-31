import { nextTheme, useTheme } from './theme';

/** La bolita: un clic cambia al siguiente tema de color (todos planos). */
export default function ThemeOrb() {
  const t = useTheme();
  return (
    <button
      type="button"
      onClick={nextTheme}
      aria-label={`Tema ${t.name}. Clic para cambiar de color`}
      title={`Tema: ${t.name} — clic para cambiar`}
      className="h-9 w-9 shrink-0 rounded-full border-2 border-fg/25 bg-accent"
    />
  );
}
