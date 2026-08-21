import React from 'react';
import { SECTIONS } from '../sections';
import type { SectionId } from '../sections';
import { useHapticFeedback } from '../hooks/useHapticFeedback';

interface FinanzasShellProps {
  section: SectionId;
  onSectionChange: (section: SectionId) => void;
  /** La barra flotante de anotar. La pone FinanzasApp para no duplicar estado. */
  accion?: React.ReactNode;
  onBack?: () => void;
  children: React.ReactNode;
}

/**
 * El armazón de la app: el contenido, y la barra de navegación de abajo.
 *
 * Antes esto tenía DOS diseños distintos según el ancho de la pantalla: un menú
 * lateral para computador y una barra de pestañas más una hoja "Más" para
 * celular. Sonaba razonable, pero salieron tres problemas de ahí:
 *
 * 1. Tres funciones no existían en el celular, por un `hidden lg:grid`.
 * 2. Contactos y Tendencias estaban en sitios distintos según el aparato: en
 * el computador había que entrar a "Configuración" para ver una gráfica, y
 * el título de la pantalla decía "Configuración" mientras mostraba otra
 * cosa.
 * 3. Al cambiar el tamaño de la ventana se podía quedar en una sección que el
 * menú de ese tamaño no listaba, sin forma de volver.
 *
 * Ahora es UNA sola barra abajo, igual en los dos. En el computador el
 * contenido se centra en una columna en vez de reorganizarse: la app no cambia
 * de forma, solo de ancho. Y así no hay dos mapas que mantener de acuerdo.
 */
export const FinanzasShell: React.FC<FinanzasShellProps> = ({
  section,
  onSectionChange,
  accion,
  onBack,
  children,
}) => {
  const haptic = useHapticFeedback();

  const handleSectionChange = (newSection: SectionId) => {
    haptic.trigger('selection');
    onSectionChange(newSection);
  };

  return (
  <div className="fin-root min-h-[100dvh] bg-[var(--fin-bg)] text-[var(--fin-ink)] antialiased">
    {/* El contenido. El hueco de abajo deja sitio para la barra y para la franja
 del iPhone, y así la última fila de la lista nunca queda tapada. */}
    <main className="mx-auto w-full max-w-[720px] px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+8.5rem)]">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 -ml-2 flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
          aria-label="Volver al inicio"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      ) : null}
      {children}
    </main>

    {accion}

    {/* La barra de navegación. Pegada al fondo, con su propia altura fija —
 antes tenía un hueco vacío abajo (`pb-[4.75rem]`) donde se metía el botón
 de anotar por encima, así que el menú quedaba arriba y el micrófono
 abajo, más cerca del borde. `BotonAnotar` ahora se posiciona por su
 cuenta justo encima de esta barra, usando su altura (`--fin-nav-h`) para
 no superponerse. */}
    <nav
      className="fin-glass fixed inset-x-0 bottom-0 z-20 flex justify-center bg-[var(--fin-card)] pb-[env(safe-area-inset-bottom)]"
      aria-label="Secciones"
    >
      {/* `data-guia` es el ancla de la guía de bienvenida. Es el único
   acoplamiento entre ella y esta barra: la guía busca la marca, no la
   estructura, así que esto se puede reordenar sin romperla. */}
      <div
        data-guia="nav"
        className="flex h-[var(--fin-nav-h)] w-full max-w-[720px] items-center justify-around px-2"
      >
        {SECTIONS.map((item) => {
          const activa = item.id === section;
          return (
            <button
              key={item.id}
              type="button"
              data-guia={`nav-${item.id}`}
              onClick={() => handleSectionChange(item.id)}
              aria-current={activa ? 'page' : undefined}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1.5"
            >
              <item.icon
                className="h-[22px] w-[22px] shrink-0 transition-colors"
                strokeWidth={activa ? 2.5 : 2}
                style={{ color: activa ? 'var(--fin-ink)' : 'var(--fin-ink-faint)' }}
                aria-hidden="true"
              />
              <span
                className="max-w-full truncate text-[13px] transition-colors"
                style={{
                  color: activa ? 'var(--fin-ink)' : 'var(--fin-ink-faint)',
                  fontWeight: activa ? 600 : 400,
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  </div>
  );
};
