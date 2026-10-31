const P: Record<string, string> = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 13l4 4L19 7',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  download: 'M12 4v12m0 0l-4-4m4 4l4-4M5 20h14',
  upload: 'M12 16V4m0 0L8 8m4-4l4 4M5 20h14',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  plus: 'M12 5v14M5 12h14',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.9M15 3.2a3.5 3.5 0 0 1 0 6.6',
  logout: 'M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9',
  menu: 'M4 6h16M4 12h16M4 18h16',
  photo: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  key: 'M14 10a4 4 0 1 1-3.5-4M10.5 9.5L3 17v4h4v-2h2v-2h2l1.5-1.5',
};
export function Icon({ name, className = 'h-5 w-5', fill = false }: { name: keyof typeof P | 'play'; className?: string; fill?: boolean }) {
  if (name === 'play') return <svg viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
  return (
    <svg viewBox="0 0 24 24" className={className} fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name]} />
    </svg>
  );
}
