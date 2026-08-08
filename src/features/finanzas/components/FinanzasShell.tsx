import React, { useState } from 'react';
import { ICONO_MAS, SECCIONES_BARRA, SECCIONES_MAS, SECTIONS, sectionLabel } from '../sections';
import type { SectionId } from '../sections';
import { BrandMark } from './BrandMark';

interface FinanzasShellProps {
  section: SectionId;
  onSectionChange: (section: SectionId) => void;
  /** Rendered to the right of the title in the desktop header. */
  toolbar?: React.ReactNode;
  /** Absent in local mode, where there is no account to sign out of. */
  cuenta?: { email: string; onSalir: () => void };
  temaToggle?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
}

/**
 * Two genuinely different layouts, not one layout that merely reflows:
 *
 * - Under 1024px it is a phone app — content fills the width and navigation is a
 *   fixed bottom tab bar, where the thumb already is. A sidebar would eat a
 *   third of a 390px screen.
 * - At 1024px and up it is a desktop dashboard — a persistent left sidebar
 *   (navigation should not cost a tap when there is room for it) and a content
 *   column that widens to a multi-column grid.
 *
 * The breakpoint is Tailwind's `lg`. Both trees are always mounted and CSS
 * decides which is visible, so there is no layout flash on load and no
 * window-width listener to keep in sync.
 */
export const FinanzasShell: React.FC<FinanzasShellProps> = ({
  section,
  onSectionChange,
  toolbar,
  cuenta,
  temaToggle,
  onBack,
  children,
}) => {
  const [masAbierto, setMasAbierto] = useState(false);
  const enMas = SECCIONES_MAS.includes(section);

  return (
  <div className="fin-root min-h-[100dvh] bg-[var(--fin-bg)] text-[var(--fin-ink)] antialiased lg:flex">
    {/* ---------- Desktop: persistent sidebar ---------- */}
    <aside className="hidden lg:flex lg:h-[100dvh] lg:w-60 lg:shrink-0 lg:flex-col lg:justify-between lg:border-r lg:border-[var(--fin-line)] lg:bg-[var(--fin-card)] lg:px-4 lg:py-6 lg:sticky lg:top-0">
      <div>
        <div className="flex items-center gap-2.5 px-2">
          {onBack && (
            <button 
              onClick={onBack}
              className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
              aria-label="Volver al ecosistema"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
          )}
          <BrandMark className="h-6 w-6" />
          <span className="text-base font-extrabold tracking-tight">Finanzas</span>
        </div>

        <nav className="mt-8 flex flex-col gap-1" aria-label="Secciones">
          {SECTIONS.map((item) => {
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                  active
                    ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
                    : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
                }`}
              >
                <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="px-3">
        {temaToggle ? <div className="mb-3">{temaToggle}</div> : null}
        {cuenta ? (
          <>
            <p className="truncate text-[11px] font-semibold text-[var(--fin-ink-soft)]">{cuenta.email}</p>
            <button
              type="button"
              onClick={cuenta.onSalir}
              className="mt-1.5 text-[11px] font-bold text-[var(--fin-ink-faint)] underline-offset-2 hover:text-[var(--fin-ink)] hover:underline"
            >
              Cerrar sesión
            </button>
          </>
        ) : null}
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">Privado · solo para ti</p>
      </div>
    </aside>

    {/* ---------- Content ---------- */}
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Mobile header. Hidden on desktop, where the sidebar carries the brand. */}
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-[var(--fin-line)] bg-[var(--fin-bg-blur)] px-4 pt-[calc(env(safe-area-inset-top)+0.875rem)] pb-3.5 backdrop-blur-md lg:hidden">
        {onBack && (
          <button 
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
            aria-label="Volver al ecosistema"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        )}
        <BrandMark className="h-5 w-5" />
        <h1 className="text-sm font-extrabold tracking-tight">Finanzas</h1>
        <div className="ml-auto flex items-center gap-2">
          {temaToggle}
          {cuenta ? (
            <button
              type="button"
              onClick={cuenta.onSalir}
              className="text-[11px] font-bold text-[var(--fin-ink-faint)]"
            >
              Salir
            </button>
          ) : null}
        </div>
      </header>

      {/* Desktop header: section title + whatever the view wants in the toolbar. */}
      <header className="hidden lg:flex lg:items-center lg:justify-between lg:gap-4 lg:border-b lg:border-[var(--fin-line)] lg:px-8 lg:py-5">
        <h1 className="text-xl font-extrabold tracking-tight">{sectionLabel(section)}</h1>
        {toolbar}
      </header>

      {/* `pb-24` on mobile clears the fixed tab bar; the safe-area inset covers
          the iPhone home indicator on top of that. */}
      <main className="flex-1 px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:px-8 lg:py-7 lg:pb-10">
        {children}
      </main>
    </div>

    {/* ---------- Mobile: fixed bottom tab bar ---------- */}
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--fin-line)] bg-[var(--fin-card)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Secciones"
    >
      {SECTIONS.filter((item) => SECCIONES_BARRA.includes(item.id)).map((item) => {
        const active = item.id === section;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSectionChange(item.id)}
            aria-current={active ? 'page' : undefined}
            // `min-w-0` lets the label truncate instead of forcing the grid
            // wider than the screen: "Movimientos" does not fit a fifth of 375px.
            className="flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2.5"
          >
            {/* The active pill is the second channel: the label also changes
                weight and colour, so it never relies on colour alone. */}
            <span
              className={`rounded-full px-3 py-1 transition-colors ${
                active ? 'bg-[var(--fin-soft)]' : ''
              }`}
              aria-hidden="true"
            >
              <item.icon className={`h-5 w-5 ${active ? item.color : ''}`} />
            </span>
            <span
              className={`max-w-full truncate text-[9px] transition-colors ${
                active ? 'font-extrabold text-[var(--fin-ink)]' : 'font-semibold text-[var(--fin-ink-faint)]'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Everything past the fourth tab lives here. Four plus "Más" keeps the
          targets wide enough to hit; a fifth real tab would not have. */}
      <button
        type="button"
        onClick={() => setMasAbierto(true)}
        aria-current={enMas ? 'page' : undefined}
        aria-haspopup="dialog"
        className="flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2.5"
      >
        <span
          className={`rounded-full px-3 py-1 transition-colors ${enMas ? 'bg-[var(--fin-soft)]' : ''}`}
          aria-hidden="true"
        >
          <ICONO_MAS className={`h-5 w-5 ${enMas ? 'text-[var(--fin-ink)]' : ''}`} />
        </span>
        <span
          className={`max-w-full truncate text-[9px] transition-colors ${
            enMas ? 'font-extrabold text-[var(--fin-ink)]' : 'font-semibold text-[var(--fin-ink-faint)]'
          }`}
        >
          Más
        </span>
      </button>
    </nav>

    {masAbierto ? (
      <div
        className="fixed inset-0 z-40 flex items-end bg-[var(--fin-scrim)] backdrop-blur-sm lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Más secciones"
        onClick={() => setMasAbierto(false)}
      >
        <div
          className="w-full rounded-t-[2rem] bg-[var(--fin-card)] px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--fin-line)]" aria-hidden="true" />
          <ul className="flex flex-col gap-1">
            {SECTIONS.filter((item) => SECCIONES_MAS.includes(item.id)).map((item) => {
              const active = item.id === section;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSectionChange(item.id);
                      setMasAbierto(false);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-bold transition-colors ${
                      active
                        ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
                        : 'text-[var(--fin-ink)] hover:bg-[var(--fin-soft)]'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 shrink-0 ${active ? '' : item.color}`} aria-hidden="true" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    ) : null}
  </div>
  );
};