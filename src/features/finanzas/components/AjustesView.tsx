import React from 'react';
import {
  ChevronRight,
  FileUp,
  HardDriveDownload,
  Flag,
  Key,
  Landmark,
  PiggyBank,
  Repeat,
  Rocket,
  Smartphone,
  Tag,
  Target,
  Users,
  Wallet,
} from 'lucide-react';
import { PANELES_AJUSTES } from '../sections';
import type { PanelAjustes } from '../sections';

interface AjustesViewProps {
  onAbrir: (panel: PanelAjustes) => void;
  temaToggle?: React.ReactNode;
  cuenta?: { email: string; onSalir: () => void };
  mostrarAhorro: boolean;
  onMostrarAhorro: (valor: boolean) => void;
  mostrarEfectivoSeparado: boolean;
  onMostrarEfectivoSeparado: (valor: boolean) => void;
  /** Ausente mientras la guía ya está visible: no hay nada que volver a abrir. */
  onVolverAVerGuia?: () => void;
}

/** Cada panel con su icono. Van aquí y no en sections.ts para que ese fichero
 * siga siendo solo datos y no arrastre media librería de iconos. */
const ICONOS: Record<
  PanelAjustes,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  cuentas: Wallet,
  categorias: Tag,
  topes: Target,
  metas: Flag,
  recurrentes: Repeat,
  extractos: FileUp,
  atajos: Smartphone,
  gmf: Landmark,
  nombres: Users,
  contraseña: Key,
  respaldo: HardDriveDownload,
};

/** Los tres bloques en que se parte la lista. Agrupar por tema hace que no haya
 * que leer las nueve filas para encontrar una. */
const BLOQUES: ReadonlyArray<{ titulo: string; paneles: readonly PanelAjustes[] }> = [
  { titulo: 'Tu dinero', paneles: ['cuentas', 'categorias', 'topes', 'metas', 'recurrentes'] },
  { titulo: 'Herramientas', paneles: ['extractos', 'atajos', 'gmf'] },
  { titulo: 'Tus datos', paneles: ['nombres', 'respaldo'] },
];

/** Una fila de la lista: icono, nombre, explicación debajo, y flecha. */
const Fila: React.FC<{
  icono: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  titulo: string;
  ayuda?: string;
  ultima: boolean;
  onClick: () => void;
}> = ({ icono: Icono, titulo, ayuda, ultima, onClick }) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--fin-soft)]"
      style={{ boxShadow: ultima ? undefined : 'inset 0 -1px 0 0 var(--fin-line)' }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]"
        aria-hidden="true"
      >
        <Icono className="h-[18px] w-[18px] text-[var(--fin-ink-soft)]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">{titulo}</span>
        {ayuda ? (
          <span className="mt-0.5 block text-[15px] leading-snug text-[var(--fin-ink-soft)]">
            {ayuda}
          </span>
        ) : null}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--fin-ink-ghost)]"
        strokeWidth={2.5}
        aria-hidden="true"
      />
    </button>
  </li>
);

/**
 * Ajustes: todo lo que se configura una vez y no se vuelve a tocar.
 *
 * Antes esto eran 6 pestañas en una barra marcada `hidden lg:grid`, y ese
 * detalle escondía un bug de verdad: en el celular la barra nunca se pintaba,
 * así que el estado se quedaba siempre en 'ajustes' y Categorías, el 4x1000, el
 * Respaldo y el Informe eran imposibles de abrir desde un teléfono. 830 líneas
 * de código que no se podían alcanzar.
 *
 * Como lista de filas, existen en todas partes. Y encima caben las cosas que
 * antes ocupaban un puesto de navegación permanente sin merecerlo: importar
 * extractos del banco se usa 0 o 2 veces al año y era la vista más grande de
 * toda la app.
 */
export const AjustesView: React.FC<AjustesViewProps> = ({
  onAbrir,
  temaToggle,
  cuenta,
  mostrarAhorro,
  onMostrarAhorro,
  mostrarEfectivoSeparado,
  onMostrarEfectivoSeparado,
  onVolverAVerGuia,
}) => (
  <div className="flex flex-col gap-7">
    <h1
      className="px-1 text-[var(--fin-ink)]"
      style={{ font: 'var(--fin-t-titulo-xl)', letterSpacing: 'var(--fin-track-titulo-xl)' }}
    >
      Ajustes
    </h1>

    {BLOQUES.map((bloque) => (
      <section key={bloque.titulo}>
        <h2 className="px-1 pb-2 text-[13px] text-[var(--fin-ink-faint)]">{bloque.titulo}</h2>
        <ul className="overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)]">
          {bloque.paneles.map((id, i) => {
            const def = PANELES_AJUSTES.find((p) => p.id === id);
            if (!def) return null;
            return (
              <Fila
                key={id}
                icono={ICONOS[id]}
                titulo={def.label}
                ayuda={def.ayuda}
                ultima={i === bloque.paneles.length - 1}
                onClick={() => onAbrir(id)}
              />
            );
          })}
        </ul>
      </section>
    ))}

    <section>
      <h2 className="px-1 pb-2 text-[13px] text-[var(--fin-ink-faint)]">La app</h2>
      <div className="overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)]">
        {/* Este interruptor vivía escondido dentro de una vista de contenido, que
 es el sitio donde nadie va a buscar un ajuste. */}
        <label
          className="flex cursor-pointer items-center gap-3 px-4 py-3.5"
          style={{ boxShadow: 'inset 0 -1px 0 0 var(--fin-line)' }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]"
            aria-hidden="true"
          >
            <PiggyBank className="h-[18px] w-[18px] text-[var(--fin-ink-soft)]" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">
              Contar los ahorros
            </span>
            <span className="mt-0.5 block text-[15px] leading-snug text-[var(--fin-ink-soft)]">
              Suma lo que tienes guardado al total de arriba
            </span>
          </span>
          <input
            type="checkbox"
            checked={mostrarAhorro}
            onChange={(e) => onMostrarAhorro(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-[var(--fin-in)]"
          />
        </label>

        <label
          className="flex cursor-pointer items-center gap-3 px-4 py-3.5"
          style={{
            boxShadow:
              onVolverAVerGuia || temaToggle || cuenta
                ? 'inset 0 -1px 0 0 var(--fin-line)'
                : undefined,
          }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]"
            aria-hidden="true"
          >
            <PiggyBank className="h-[18px] w-[18px] text-[var(--fin-ink-soft)]" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">
              Mostrar efectivo por separado
            </span>
            <span className="mt-0.5 block text-[15px] leading-snug text-[var(--fin-ink-soft)]">
              Desglosar el dinero en efectivo del total
            </span>
          </span>
          <input
            type="checkbox"
            checked={mostrarEfectivoSeparado}
            onChange={(e) => onMostrarEfectivoSeparado(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-[var(--fin-in)]"
          />
        </label>

        {onVolverAVerGuia ? (
          <button
            type="button"
            onClick={onVolverAVerGuia}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--fin-soft)]"
            style={{ boxShadow: temaToggle || cuenta ? 'inset 0 -1px 0 0 var(--fin-line)' : undefined }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]"
              aria-hidden="true"
            >
              <Rocket className="h-[18px] w-[18px] text-[var(--fin-ink-soft)]" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">
                Volver a ver la guía
              </span>
              <span className="mt-0.5 block text-[15px] leading-snug text-[var(--fin-ink-soft)]">
                Te vuelve a señalar cómo funciona la app
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-[var(--fin-ink-ghost)]"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </button>
        ) : null}

        {temaToggle ? (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3.5"
            style={{ boxShadow: cuenta ? 'inset 0 -1px 0 0 var(--fin-line)' : undefined }}
          >
            <span className="text-[17px] font-semibold text-[var(--fin-ink)]">Apariencia</span>
            {temaToggle}
          </div>
        ) : null}

        {cuenta ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="min-w-0">
              <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">Cuenta</span>
              <span className="mt-0.5 block truncate text-[15px] text-[var(--fin-ink-soft)]">
                {cuenta.email}
              </span>
            </span>
            <button
              type="button"
              onClick={cuenta.onSalir}
              className="shrink-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3.5 py-2 text-[15px] font-semibold text-[var(--fin-ink)]"
            >
              Cerrar sesión
            </button>
          </div>
        ) : null}
      </div>
    </section>

  </div>
);
