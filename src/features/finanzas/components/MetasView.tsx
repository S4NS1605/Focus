import React, { useState } from 'react';
import { CheckCircle2, Plus, Target, Trash2 } from 'lucide-react';
import { COPY } from '../copy';
import { iconoDeMeta } from '../cajitaIconos';
import type { Cajita, Meta } from '../data/modelos';
import { CAJITA_ICONS } from '../data/modelos';
import { metasConProgreso } from '../lib/metas';
import type { ProgresoMeta } from '../lib/metas';
import { saldosPorCajita } from '../lib/cajitas';
import type { CajitaMovimiento } from '../data/modelos';
import { formatAmountInput, formatCop, parseAmountInput } from '../lib/formatCop';
import { bogotaDate } from '../lib/localDate';

interface MetasViewProps {
  metas: readonly Meta[];
  cajitas: readonly Cajita[];
  movimientos: readonly CajitaMovimiento[];
  onCrear: (datos: Omit<Meta, 'id' | 'createdAt' | 'completedAt'>) => void;
  onActualizar: (meta: Meta) => void;
  onEliminar: (id: string) => void;
}

const Progreso: React.FC<{ progreso: ProgresoMeta }> = ({ progreso }) => (
  <>
    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--fin-soft)]">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${progreso.pct}%`,
          backgroundColor: progreso.completada ? 'var(--fin-in)' : 'var(--fin-ink)',
        }}
      />
    </div>
    <div className="mt-2 flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-bold tabular-nums text-[var(--fin-ink)]">
        {formatCop(progreso.ahorradoCop)}
        <span className="font-medium text-[var(--fin-ink-faint)]"> / {formatCop(progreso.objetivoCop)}</span>
      </span>
      <span className="text-[11px] font-bold tabular-nums text-[var(--fin-ink-soft)]">{progreso.pct}%</span>
    </div>
  </>
);

export const MetasView: React.FC<MetasViewProps> = ({
  metas,
  cajitas,
  movimientos,
  onCrear,
  onActualizar,
  onEliminar,
}) => {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [icon, setIcon] = useState<string>(CAJITA_ICONS[0]);
  const [objetivoTexto, setObjetivoTexto] = useState('');
  const [fecha, setFecha] = useState('');
  const [cajitaId, setCajitaId] = useState('');
  const [editandoAhorro, setEditandoAhorro] = useState<string | null>(null);
  const [ahorroTexto, setAhorroTexto] = useState('');

  const hoy = bogotaDate();
  const saldos = saldosPorCajita(movimientos);
  const filas = metasConProgreso(metas, saldos, hoy);
  const vivas = cajitas.filter((c) => c.archivedAt === null);

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim();
    const objetivo = parseAmountInput(objetivoTexto);
    if (!limpio || objetivo === null) return;

    onCrear({
      nombre: limpio,
      icon,
      objetivoCop: objetivo,
      fechaObjetivo: fecha || null,
      cajitaId: cajitaId || null,
      ahorradoCop: 0,
    });
    setNombre('');
    setObjetivoTexto('');
    setFecha('');
    setCajitaId('');
    setCreando(false);
  };

  const guardarAhorro = (meta: Meta) => {
    const valor = parseAmountInput(ahorroTexto);
    if (valor !== null) onActualizar({ ...meta, ahorradoCop: valor });
    setEditandoAhorro(null);
    setAhorroTexto('');
  };

  return (
    // Mismo criterio que CajitasView/DeudasView: formulario en columna
    // angosta, tarjetas de metas en su propia grilla ancha.
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      {creando ? (
        <form onSubmit={crear} className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
          <h2 className="text-xs font-bold text-[var(--fin-ink-soft)]">{COPY.metas.nueva}</h2>

          <label htmlFor="meta-nombre" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            {COPY.metas.nombre}
          </label>
          <input
            id="meta-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={COPY.metas.nombrePlaceholder}
            autoFocus
            className="mt-2 w-full rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-base font-medium text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
          />

          <fieldset className="mt-4">
            <legend className="text-xs font-bold text-[var(--fin-ink-soft)]">Ícono</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CAJITA_ICONS.map((option) => {
                const Icon = iconoDeMeta(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setIcon(option)}
                    aria-pressed={icon === option}
                    aria-label={`Ícono ${option}`}
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border-2 transition-colors ${
                      icon === option ? 'border-[var(--fin-ink)] bg-[var(--fin-soft)]' : 'border-[var(--fin-line)] bg-[var(--fin-card)]'
                    }`}
                  >
                    <Icon className="h-5 w-5 text-[var(--fin-ink-soft)]" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label htmlFor="meta-objetivo" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            {COPY.metas.objetivo}
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3">
            <span className="font-display text-xl font-extrabold text-[var(--fin-ink-faint)]">$</span>
            <input
              id="meta-objetivo"
              value={objetivoTexto}
              onChange={(e) => setObjetivoTexto(formatAmountInput(parseAmountInput(e.target.value)))}
              inputMode="numeric"
              placeholder="0"
              className="w-full bg-transparent font-display text-xl font-extrabold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            />
          </div>

          <label htmlFor="meta-fecha" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            {COPY.metas.fecha}
          </label>
          <input
            id="meta-fecha"
            type="date"
            value={fecha}
            min={hoy}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-2 w-full rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-base font-medium text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
          />

          <label htmlFor="meta-cajita" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            {COPY.metas.enlazar}
          </label>
          <select
            id="meta-cajita"
            value={cajitaId}
            onChange={(e) => setCajitaId(e.target.value)}
            className="mt-2 w-full rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-base font-medium text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
          >
            <option value="">{COPY.metas.sinEnlace}</option>
            {vivas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              disabled={nombre.trim() === '' || parseAmountInput(objetivoTexto) === null}
              className="flex-1 rounded-full bg-[var(--fin-accent)] px-6 py-3.5 text-sm font-bold text-[var(--fin-on-accent)] disabled:opacity-30"
            >
              {COPY.metas.crear}
            </button>
            <button
              type="button"
              onClick={() => setCreando(false)}
              className="rounded-full bg-[var(--fin-soft)] px-6 py-3.5 text-sm font-bold text-[var(--fin-ink-soft)]"
            >
              {COPY.confirm.cancel}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-4 text-sm font-bold text-[var(--fin-ink-soft)] transition-colors hover:border-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          {COPY.metas.nueva}
        </button>
      )}

      {filas.length === 0 && !creando ? (
        <div className="rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-12 text-center flex flex-col items-center">
          <span className="block text-[var(--fin-ink-ghost)] mb-2 flex justify-center" aria-hidden="true">
            <Target className="h-10 w-10" strokeWidth={1.5} />
          </span>
          <p className="mt-3 text-sm font-bold text-[var(--fin-ink)]">{COPY.metas.vacio}</p>
          <p className="mt-1 text-xs text-[var(--fin-ink-faint)]">{COPY.metas.vacioHint}</p>
        </div>
      ) : null}
      </div>

      {filas.length > 0 ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filas.map(({ meta, progreso }) => {
        const cajita = meta.cajitaId ? cajitas.find((c) => c.id === meta.cajitaId) : undefined;

        return (
          <section key={meta.id} className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
            <div className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--fin-soft)]"
                aria-hidden="true"
              >
                {(() => {
                  const Icon = iconoDeMeta(meta.icon);
                  return <Icon className="h-5 w-5 text-[var(--fin-ink-soft)]" />;
                })()}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-extrabold text-[var(--fin-ink)]">{meta.nombre}</h3>
                <p className="text-[11px] text-[var(--fin-ink-faint)]">
                  {cajita ? `Sigue la cajita ${cajita.nombre}` : COPY.metas.sinEnlace}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEliminar(meta.id)}
                aria-label={`${COPY.metas.eliminar}: ${meta.nombre}`}
                className="shrink-0 rounded-xl p-1.5 text-[var(--fin-ink-ghost)] transition-colors hover:bg-[var(--fin-out-bg)] hover:text-[var(--fin-out)]"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>

            <Progreso progreso={progreso} />

            <div className="mt-3 rounded-2xl bg-[var(--fin-bg)] px-4 py-3">
              {progreso.completada ? (
                <p className="text-xs font-bold text-[var(--fin-in)]">
                  {(() => {
                    const Icon = CheckCircle2;
                    return <Icon className="mr-1.5 inline h-4 w-4" />;
                  })()}
                  {COPY.metas.lograda}
                </p>
              ) : (
                <>
                  <p className="text-xs font-bold text-[var(--fin-ink)]">
                    {COPY.metas.falta} {formatCop(progreso.faltaCop)}
                  </p>
                  {progreso.ritmoMensualCop !== null ? (
                    <p className="mt-1 text-[11px] text-[var(--fin-ink-soft)]">
                      {COPY.metas.ritmo}{' '}
                      <span className="font-bold tabular-nums text-[var(--fin-ink)]">
                        {formatCop(progreso.ritmoMensualCop)}
                      </span>{' '}
                      {COPY.metas.porMes} · {progreso.diasRestantes} {COPY.metas.diasRestantes}
                    </p>
                  ) : progreso.diasRestantes !== null && progreso.diasRestantes <= 0 ? (
                    <p className="mt-1 text-[11px] font-bold text-[var(--fin-warn)]">
                      {COPY.metas.vencida}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {/* Unlinked goals are maintained by hand */}
            {meta.cajitaId === null ? (
              editandoAhorro === meta.id ? (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2">
                    <span className="font-display text-lg font-extrabold text-[var(--fin-ink-faint)]">$</span>
                    <input
                      value={ahorroTexto}
                      onChange={(e) =>
                        setAhorroTexto(formatAmountInput(parseAmountInput(e.target.value)))
                      }
                      inputMode="numeric"
                      autoFocus
                      aria-label={COPY.metas.ahorrado}
                      className="w-full bg-transparent font-display text-lg font-extrabold tabular-nums text-[var(--fin-ink)] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => guardarAhorro(meta)}
                    className="rounded-full bg-[var(--fin-accent)] px-4 py-2.5 text-xs font-bold text-[var(--fin-on-accent)]"
                  >
                    {COPY.confirm.save}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditandoAhorro(meta.id);
                    setAhorroTexto(formatAmountInput(meta.ahorradoCop));
                  }}
                  className="mt-3 w-full rounded-full bg-[var(--fin-soft)] px-4 py-2.5 text-xs font-bold text-[var(--fin-ink-soft)] transition-colors hover:text-[var(--fin-ink)]"
                >
                  {COPY.metas.ahorrado}: {formatCop(progreso.ahorradoCop)}
                </button>
              )
            ) : null}
          </section>
        );
          })}
        </div>
      ) : null}
    </div>
  );
};
