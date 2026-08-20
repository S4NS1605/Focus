import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Mic, Search, Settings2 } from 'lucide-react';
import { TransactionList } from '../TransactionList';
import { formatCop } from '../../lib/formatCop';
import { monthKeyLabel } from '../../lib/localDate';
import { CifraViva } from './CifraViva';
import { useEnPantalla, useTecleo } from './ganchos';
import {
  GASTOS_INICIALES,
  GUION,
  INGRESOS_INICIALES,
  MES_ACTUAL,
  MOVIMIENTOS_BASE,
  SALDO_INICIAL,
  movimientoDelPaso,
} from './guionDemo';

/** Cuánto dura cada paso: teclear la frase y dejarla leer antes de la siguiente. */
const MS_POR_LETRA = 45;
const MS_REPOSO = 1500;
/** La pausa antes de volver a empezar, para que el ciclo no parezca un salto. */
const MS_ANTES_DE_REINICIAR = 2600;

/**
 * El teléfono de la portada.
 *
 * La pantalla de adentro no es un dibujo parecido al dashboard: es el dashboard.
 * La lista de movimientos es el mismo `TransactionList` que corre en la app —
 * fuera de su provider cae en `CATALOGO_BASE`, que es justo para lo que ese
 * default existe— así que los iconos, los colores de categoría, el agrupado por
 * día y el formato de las cifras no pueden desincronizarse de lo que ve alguien
 * que ya usa Lukapp. Si un día cambia la fila, cambia aquí sola.
 *
 * Lo que sí es de la portada son los tokens: `finanzas.css` no se carga aquí, y
 * cargarlo entero por un mockup traería la hoja completa de la app. En su lugar
 * el contenedor `.pantalla-app` declara los `--fin-*` que la fila usa, mapeados
 * desde la paleta de la landing para que el teléfono siga el tema claro/oscuro
 * como el resto de la página.
 */
export const MockupTelefono: React.FC = () => {
  const quieto = useReducedMotion();
  const { ref, enVista } = useEnPantalla<HTMLDivElement>(0.25);

  /* `paso` es cuántas frases del guion ya se aplicaron. Va de 0 a GUION.length
     y vuelve a 0, indefinidamente. */
  const [paso, setPaso] = useState(0);
  const pasoActual = GUION[paso % GUION.length];
  const completo = paso >= GUION.length;

  // Con movimiento reducido no hay ciclo: se enseña el mes ya lleno y quieto.
  const aplicados = quieto ? GUION.length : Math.min(paso, GUION.length);

  const { visible, listo } = useTecleo(
    completo ? '' : pasoActual.frase,
    enVista && !quieto && !completo,
    MS_POR_LETRA,
  );

  /* El avance del ciclo: cuando la frase termina de teclearse se espera un poco
     y se aplica; cuando ya se aplicaron todas, se espera más y se reinicia. */
  useEffect(() => {
    if (!enVista || quieto) return;

    if (completo) {
      const id = setTimeout(() => setPaso(0), MS_ANTES_DE_REINICIAR);
      return () => clearTimeout(id);
    }

    if (!listo) return;
    const id = setTimeout(() => setPaso((n) => n + 1), MS_REPOSO);
    return () => clearTimeout(id);
  }, [enVista, quieto, listo, completo, paso]);

  const nuevos = GUION.slice(0, aplicados).map(movimientoDelPaso);

  const movimientos = [...nuevos, ...MOVIMIENTOS_BASE];

  const saldo =
    SALDO_INICIAL +
    nuevos.reduce((s, t) => s + (t.kind === 'ingreso' ? t.amountCop : -t.amountCop), 0);
  const gastos =
    GASTOS_INICIALES + nuevos.reduce((s, t) => s + (t.kind === 'gasto' ? t.amountCop : 0), 0);
  const ingresos =
    INGRESOS_INICIALES + nuevos.reduce((s, t) => s + (t.kind === 'ingreso' ? t.amountCop : 0), 0);

  return (
    <div className="telefono-envoltura" ref={ref} aria-hidden="true">
      {/* El resplandor va fuera del marco y no dentro: el marco pinta su propio
          fondo de titanio antes que a sus hijos, así que un destello metido
          adentro quedaría tapado hiciera lo que hiciera con el z-index. */}
      <motion.span
        className="telefono-destello"
        initial={false}
        animate={{ opacity: !quieto && enVista && aplicados > 0 && !completo ? [0, 0.55, 0] : 0 }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        key={aplicados}
      />

      <div className="telefono-marco">
        <span className="telefono-boton-accion" />
      <span className="telefono-boton-vol arriba" />
      <span className="telefono-boton-vol abajo" />
      <span className="telefono-boton-lateral" />

      <div className="telefono-pantalla">
        <span className="isla-dinamica" />

        <div className="pantalla-app">
          {/* Cabecera: el mes a la izquierda, buscar y ajustes a la derecha. */}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3.5 py-2 text-[15px] font-semibold capitalize text-[var(--fin-ink)]">
              {monthKeyLabel(MES_ACTUAL)}
              <ChevronDown className="h-4 w-4 text-[var(--fin-ink-faint)]" strokeWidth={2.5} />
            </span>

            <div className="flex gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
                <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
                <Settings2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
            </div>
          </div>

          {/* El número. El único por encima de 28px, como en la app. */}
          <p className="mt-6 text-center text-[13px] text-[var(--fin-ink-faint)]">Tienes en total</p>
          <div
            className="mt-1 text-center tabular-nums text-[var(--fin-ink)]"
            style={{ font: 'var(--fin-t-cifra)', letterSpacing: 'var(--fin-track-cifra)' }}
          >
            <CifraViva valor={saldo} formato={(n) => formatCop(Math.round(n))} />
          </div>

          {/* Lo que salió y lo que entró, en un solo control. */}
          <div className="mt-4 flex justify-center">
            <div className="flex overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
              <span
                className="px-4 py-2.5 text-[17px] font-semibold tabular-nums"
                style={{ color: 'var(--fin-out)' }}
              >
                ↓ <CifraViva valor={gastos} formato={(n) => formatCop(Math.round(n))} />
              </span>
              <span
                className="border-l border-[var(--fin-line)] px-4 py-2.5 text-[17px] font-semibold tabular-nums"
                style={{ color: 'var(--fin-in)' }}
              >
                ↑ <CifraViva valor={ingresos} formato={(n) => formatCop(Math.round(n))} />
              </span>
            </div>
          </div>

          <div className="mt-7">
            <TransactionList transactions={movimientos} />
          </div>
        </div>

        {/* La barra del micrófono: lo que se está dictando ahora mismo. Va sobre
            la pantalla, como el botón de anotar de la app. */}
        <div className="barra-dictado">
          <span className="dictado-boton">
            <Mic size={17} strokeWidth={2} />
            {!quieto && enVista && !completo && !listo && <span className="dictado-pulso" />}
          </span>
          <span className="dictado-texto">
            {quieto ? 'gasté 45 mil en almuerzo' : visible}
            {!quieto && !completo && !listo && <span className="dictado-cursor" />}
          </span>
        </div>

          {/* El degradado de abajo: la lista se desvanece detrás de la barra en
              vez de cortarse en seco contra ella. */}
          <span className="pantalla-velo" />
        </div>
      </div>
    </div>
  );
};
