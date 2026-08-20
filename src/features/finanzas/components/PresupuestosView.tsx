import React, { useMemo, useState } from 'react';
import { Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import type { Transaction } from '../types';
import type { Presupuesto, TonoPresupuesto } from '../lib/presupuestos';
import { estadoDeTodos, tonoDe } from '../lib/presupuestos';
import { useCatalogo } from '../catalogoContexto';
import { formatCop, parseAmountInput, conPuntos } from '../lib/formatCop';

interface PresupuestosViewProps {
  presupuestos: readonly Presupuesto[];
  transacciones: readonly Transaction[];
  mes: string;
  hoy: string;
  onFijar: (categoria: string, montoCop: number) => void;
  onQuitar: (categoria: string) => void;
}

const COLOR: Record<TonoPresupuesto, string> = {
  bien: 'var(--fin-in)',
  atento: 'var(--fin-warn)',
  excedido: 'var(--fin-out)',
};

/** 16px minimum: anything smaller makes iOS zoom the page in on focus. */
const CAMPO =
  'w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none';

/**
 * Cómo va el mes contra los topes que el usuario se puso.
 *
 * Lo que hace útil a esta pantalla no es el total al cierre — eso ya lo dice el
 * resumen — sino la proyección: avisa mientras todavía queda mes por delante
 * para hacer algo. Un presupuesto que solo informa al día 31 es un informe.
 */
export const PresupuestosView: React.FC<PresupuestosViewProps> = ({
  presupuestos,
  transacciones,
  mes,
  hoy,
  onFijar,
  onQuitar,
}) => {
  const catalogo = useCatalogo();
  const [creando, setCreando] = useState(false);
  const [categoria, setCategoria] = useState('');
  const [monto, setMonto] = useState('');

  const estados = useMemo(
    () => estadoDeTodos(presupuestos, transacciones, mes, hoy),
    [presupuestos, transacciones, mes, hoy],
  );

  const yaTienen = new Set(presupuestos.map((p) => p.categoria));
  const disponibles = catalogo.lista.filter((c) => !yaTienen.has(c.clave));

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseAmountInput(monto);
    if (categoria === '' || valor === null || valor <= 0) return;
    onFijar(categoria, valor);
    setCreando(false);
    setCategoria('');
    setMonto('');
  };

  return (
    <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
          <Target className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          Presupuestos del mes
        </h2>
        {!creando && disponibles.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setCategoria(disponibles[0].clave);
              setCreando(true);
            }}
            className="flex items-center gap-1.5 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] px-3 py-1.5 text-[13px] font-semibold text-[var(--fin-ink)]"
          >
            <Plus className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            Nuevo
          </button>
        ) : null}
      </div>

      {creando ? (
        <form
          onSubmit={crear}
          className="mt-3 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-3"
        >
          <label
            htmlFor="pre-categoria"
            className="block text-[13px] font-semibold text-[var(--fin-ink-soft)]"
          >
            ¿En qué?
          </label>
          <select
            id="pre-categoria"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className={`mt-1.5 ${CAMPO}`}
          >
            {disponibles.map((c) => (
              <option key={c.clave} value={c.clave}>
                {c.nombre}
              </option>
            ))}
          </select>

          <label
            htmlFor="pre-monto"
            className="mt-3 block text-[13px] font-semibold text-[var(--fin-ink-soft)]"
          >
            Máximo al mes
          </label>
          <input
            id="pre-monto"
            value={monto}
            onChange={(e) => setMonto(conPuntos(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            autoFocus
            className={`mt-1.5 ${CAMPO}`}
          />

          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-on-accent)]"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setCreando(false)}
              className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-ink-soft)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {estados.length === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
          Ponle un tope a una categoría y aquí te digo cómo vas — y si al ritmo actual te vas a
          pasar antes de que acabe el mes.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {estados.map((e) => {
            const tono = tonoDe(e);
            const entrada = catalogo.de(e.categoria);
            return (
              <li key={e.categoria}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <entrada.Icono
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: entrada.color }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-[15px] font-semibold text-[var(--fin-ink)]">
                      {entrada.nombre}
                    </span>
                  </span>
                  <span className="shrink-0 text-[13px] tabular-nums text-[var(--fin-ink-soft)]">
                    <b className="text-[var(--fin-ink)]">{formatCop(e.gastadoCop)}</b> de{' '}
                    {formatCop(e.topeCop)}
                  </span>
                </div>

                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]"
                  role="img"
                  aria-label={`${entrada.nombre}: ${e.pctUsado}% del presupuesto`}
                >
                  <div
                    className="h-full rounded-[var(--fin-r-pill)] transition-[width]"
                    style={{ width: `${Math.min(100, e.pctUsado)}%`, backgroundColor: COLOR[tono] }}
                  />
                </div>

                <div className="mt-1 flex items-center justify-between gap-2">
                  {/* La proyección va SIEMPRE aparte del gasto real y nunca en su
 lugar: es una suposición, y darla por hecha llevaría a
 decidir sobre plata que todavía no ha salido. */}
                  <p className="text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
                    {e.excedidoCop > 0 ? (
                      <span style={{ color: 'var(--fin-out)' }}>
                        Te pasaste por {formatCop(e.excedidoCop)}.
                      </span>
                    ) : e.vaARebasar ? (
                      <span
                        className="inline-flex items-center gap-1"
                        style={{ color: 'var(--fin-warn)' }}
                      >
                        <TrendingUp className="h-3 w-3" strokeWidth={3} aria-hidden="true" />A este
                        ritmo cerrarías en {formatCop(e.proyectadoCop)}.
                      </span>
                    ) : (
                      <>Te quedan {formatCop(e.disponibleCop)}.</>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => onQuitar(e.categoria)}
                    aria-label={`Quitar el presupuesto de ${entrada.nombre}`}
                    className="shrink-0 rounded-[var(--fin-r-control)] p-1 text-[var(--fin-ink-ghost)] hover:text-[var(--fin-out)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
