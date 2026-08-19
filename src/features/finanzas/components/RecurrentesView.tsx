import React, { useMemo, useState } from 'react';
import { Check, Plus, Repeat, Trash2 } from 'lucide-react';
import type { Transaction } from '../types';
import type { Pendiente, Recurrente } from '../lib/recurrentes';
import { pendientesDelMes, totalMensual } from '../lib/recurrentes';
import { useCatalogo } from '../catalogoContexto';
import { formatCop, formatAmountInput, parseAmountInput } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';

interface RecurrentesViewProps {
  recurrentes: readonly Recurrente[];
  transacciones: readonly Transaction[];
  cuentas: readonly { id: string; nombre: string }[];
  mes: string;
  hoy: string;
  onCrear: (datos: Omit<Recurrente, 'id' | 'createdAt' | 'archivedAt'>) => void;
  onBorrar: (id: string) => void;
  onConfirmar: (pendiente: Pendiente) => void;
}

/** 16px minimum: anything smaller makes iOS zoom the page in on focus. */
const CAMPO =
  'w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none';

/**
 * Lo que se repite cada mes.
 *
 * La app propone y el usuario confirma, siempre. Registrar solo un cobro que
 * quizá no ocurrió — te cancelaron el servicio, cambió el monto, el banco lo
 * rechazó — deja el saldo mintiendo, y eso no se nota hasta que el mes cuadra
 * mal. Un toque es barato; un libro con plata inventada, no.
 */
export const RecurrentesView: React.FC<RecurrentesViewProps> = ({
  recurrentes,
  transacciones,
  cuentas,
  mes,
  hoy,
  onCrear,
  onBorrar,
  onConfirmar,
}) => {
  const catalogo = useCatalogo();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [kind, setKind] = useState<'gasto' | 'ingreso'>('gasto');
  const [categoria, setCategoria] = useState('otros');
  const [cuentaId, setCuentaId] = useState<string>('');
  const [dia, setDia] = useState('1');

  const pendientes = useMemo(
    () => pendientesDelMes(recurrentes, transacciones, mes, hoy),
    [recurrentes, transacciones, mes, hoy],
  );
  const vivos = recurrentes.filter((r) => r.archivedAt === null);
  const total = totalMensual(vivos);

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = parseAmountInput(monto);
    const diaNum = Number(dia);
    if (nombre.trim() === '' || valor === null || valor <= 0) return;
    onCrear({
      nombre: nombre.trim(),
      kind,
      amountCop: valor,
      categoria,
      cuentaId: cuentaId || null,
      diaDelMes: Math.min(31, Math.max(1, diaNum || 1)),
    });
    setCreando(false);
    setNombre('');
    setMonto('');
  };

  return (
    // Mismo criterio que CajitasView: resumen/pendientes/formulario en
    // columna angosta, la lista de recurrentes en su propia grilla ancha.
    // `w-full` por consistencia -- ver el comentario en TendenciasView.tsx.
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
            <Repeat className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            Cada mes
          </h2>
          <p className="mt-1 text-[44px] font-semibold tabular-nums text-[var(--fin-ink)]">
            {formatCop(total.gastoCop)}
          </p>
          <p className="mt-1 text-[13px] text-[var(--fin-ink-faint)]">
            sale fijo en {vivos.length} {vivos.length === 1 ? 'cosa' : 'cosas'}
            {total.ingresoCop > 0 ? ` · entran ${formatCop(total.ingresoCop)}` : ''}
          </p>
        </section>

        {/* Pendientes: lo único que pide acción */}
        {pendientes.length > 0 ? (
          <section className="rounded-[var(--fin-r-card)] border border-dashed border-[var(--fin-line)] bg-[var(--fin-bg)] p-4">
            <p className="text-[13px] font-semibold text-[var(--fin-ink)]">
              Ya pasó la fecha de {pendientes.length}{' '}
              {pendientes.length === 1 ? 'movimiento' : 'movimientos'}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
              Confirma solo los que de verdad ocurrieron.
            </p>

            <ul className="mt-2.5 flex flex-col gap-1.5">
              {pendientes.map((p) => (
                <li
                  key={p.recurrente.id}
                  className="flex items-center gap-3 rounded-[var(--fin-r-control)] bg-[var(--fin-card)] px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-[var(--fin-ink)]">
                      {p.recurrente.nombre}
                    </span>
                    <span className="block text-[13px] text-[var(--fin-ink-faint)]">
                      {dayLabel(p.fecha)} · {formatCop(p.recurrente.amountCop)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onConfirmar(p)}
                    className="flex shrink-0 items-center gap-1.5 rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-on-accent)]"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    Sí pasó
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Crear */}
        {creando ? (
          <form onSubmit={crear} className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
            <label
              htmlFor="rec-nombre"
              className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
            >
              ¿Qué es?
            </label>
            <input
              id="rec-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Arriendo"
              autoFocus
              className={`mt-1.5 ${CAMPO}`}
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="rec-monto"
                  className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
                >
                  Cuánto
                </label>
                <input
                  id="rec-monto"
                  value={monto}
                  onChange={(e) => setMonto(formatAmountInput(parseAmountInput(e.target.value)))}
                  inputMode="numeric"
                  placeholder="0"
                  className={`mt-1.5 ${CAMPO}`}
                />
              </div>
              <div>
                <label
                  htmlFor="rec-dia"
                  className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
                >
                  Qué día
                </label>
                <input
                  id="rec-dia"
                  value={dia}
                  onChange={(e) => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  inputMode="numeric"
                  className={`mt-1.5 ${CAMPO}`}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="rec-kind"
                  className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
                >
                  Tipo
                </label>
                <select
                  id="rec-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as 'gasto' | 'ingreso')}
                  className={`mt-1.5 ${CAMPO}`}
                >
                  <option value="gasto">Sale</option>
                  <option value="ingreso">Entra</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="rec-cat"
                  className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
                >
                  Categoría
                </label>
                <select
                  id="rec-cat"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className={`mt-1.5 ${CAMPO}`}
                >
                  {catalogo.lista.map((c) => (
                    <option key={c.clave} value={c.clave}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {cuentas.length > 0 ? (
              <div className="mt-3">
                <label
                  htmlFor="rec-cuenta"
                  className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
                >
                  ¿De qué cuenta? (opcional)
                </label>
                <select
                  id="rec-cuenta"
                  value={cuentaId}
                  onChange={(e) => setCuentaId(e.target.value)}
                  className={`mt-1.5 ${CAMPO}`}
                >
                  <option value="">No indicar</option>
                  {cuentas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[17px] font-semibold text-[var(--fin-on-accent)]"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setCreando(false)}
                className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] px-4 py-3 text-[17px] font-semibold text-[var(--fin-ink-soft)]"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] border-2 border-dashed border-[var(--fin-line)] px-6 py-4 text-[17px] font-semibold text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]"
          >
            <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            Nuevo recurrente
          </button>
        )}

        {/* Lista */}
        {vivos.length === 0 ? (
          <p className="px-1 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
            El arriendo, Netflix, el gimnasio. La app te los recuerda cada mes y tú confirmas si de
            verdad pasaron — no los registra sola.
          </p>
        ) : null}
      </div>

      {vivos.length > 0 ? (
        <ul className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {vivos.map((r) => {
            const entrada = catalogo.de(r.categoria);
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4 py-3"
              >
                <entrada.Icono
                  className="h-4 w-4 shrink-0"
                  style={{ color: entrada.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold text-[var(--fin-ink)]">
                    {r.nombre}
                  </span>
                  <span className="block text-[13px] text-[var(--fin-ink-faint)]">
                    el {r.diaDelMes} de cada mes · {entrada.nombre}
                  </span>
                </span>
                <span
                  className="shrink-0 text-[17px] font-semibold tabular-nums"
                  style={{ color: r.kind === 'ingreso' ? 'var(--fin-in)' : 'var(--fin-out)' }}
                >
                  {r.kind === 'ingreso' ? '+' : '−'}
                  {formatCop(r.amountCop)}
                </span>
                <button
                  type="button"
                  onClick={() => onBorrar(r.id)}
                  aria-label={`Eliminar ${r.nombre}`}
                  className="shrink-0 rounded-[var(--fin-r-control)] p-1.5 text-[var(--fin-ink-ghost)] hover:text-[var(--fin-out)]"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
