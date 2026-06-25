/** Conteneur paddé + largeur max pour les pages classiques (pas la Map plein écran). */
export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="nt-in mx-auto max-w-[1180px] px-6 py-7 lg:px-9">{children}</div>;
}
