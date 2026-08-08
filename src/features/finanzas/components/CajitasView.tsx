import React, { useState } from 'react';
import { PiggyBank, Plus } from 'lucide-react';
import { COPY } from '../copy';
import { iconoDeCajita } from '../cajitaIconos';
import type { Cajita, CajitaMovimiento, CajitaMovKind, CajitaTipo } from '../data/modelos';
import { CAJITA_ICONS } from '../data/modelos';
import { resumenDeCajitas } from '../lib/cajitas';
import { formatAmountInput, formatCop, parseAmountInput } from '../lib/formatCop';
import { CajitaCard } from './CajitaCard';

interface CajitasViewProps {
  /**
   * Which kind this screen manages. Accounts and pockets are the same structure
   * but different subjects, so each gets its own screen rather than a selector
   * buried in a shared form — the screen you are on already answers "what is
   * this", and asking again inside the form only hid the option.
   */
  tipo: CajitaTipo;
  cajitas: readonly Cajita[];
  movimientos: readonly CajitaMovimiento[];
  onCrear: (datos: {
    nombre: string;
    icon: string;
    tipo: CajitaTipo;
    metaCop: number | null;
    tasaEaPct: number | null;
    saldoInicialCop: number;
  }) => void;
  onFijarSaldo: (cajitaId: string, saldo: number) => void;
  onMovimiento: (cajitaId: string, kind: CajitaMovKind, deltaCop: number) => void;
  onEliminar: (cajitaId: string) => void;
}

export const CajitasView: React.FC<CajitasViewProps> = ({
  tipo,
  cajitas,
  movimientos,
  onCrear,
  onFijarSaldo,
  onMovimiento,
  onEliminar,
}) => {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [icon, setIcon] = useState<string>(CAJITA_ICONS[0]);
  const [saldoTexto, setSaldoTexto] = useState('');
  const [metaTexto, setMetaTexto] = useState('');
  const [tasaTexto, setTasaTexto] = useState('');

  const propias = cajitas.filter((c) => c.tipo === tipo);
  const resumenes = resumenDeCajitas(propias, movimientos);
  const esCuenta = tipo === 'cuenta';
  const total = resumenes.reduce((t, r) => t + r.saldoCop, 0);

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return;

    // Comma is the decimal separator on a Colombian keyboard; accept both.
    const tasa = Number.parseFloat(tasaTexto.replace(',', '.'));
    onCrear({
      nombre: limpio,
      icon,
      tipo,
      metaCop: parseAmountInput(metaTexto),
      tasaEaPct: Number.isFinite(tasa) && tasa > 0 ? tasa : null,
      saldoInicialCop: parseAmountInput(saldoTexto) ?? 0,
    });
    setNombre('');
    setIcon(CAJITA_ICONS[0]);
    setSaldoTexto('');
    setMetaTexto('');
    setTasaTexto('');
    setCreando(false);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {/* Total across every live pocket */}
      <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
        <h2 className="text-xs font-bold text-[var(--fin-ink-soft)]">
          <PiggyBank className="inline h-4 w-4 mr-1 mb-0.5" aria-hidden="true" />
          {esCuenta ? COPY.cuentas.total : COPY.cajitas.total}
        </h2>
        <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-[var(--fin-ink)]">
          {formatCop(total)}
        </p>
        {resumenes.length > 0 ? (
          <p className="mt-1 text-[11px] text-[var(--fin-ink-faint)]">
            repartido en {resumenes.length} {esCuenta ? 'cuenta' : 'cajita'}
            {resumenes.length === 1 ? '' : 's'}
          </p>
        ) : null}
      </section>

      {/* Create */}
      {creando ? (
        <form onSubmit={crear} className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
          <h2 className="text-xs font-bold text-[var(--fin-ink-soft)]">{esCuenta ? COPY.cuentas.nueva : COPY.cajitas.nueva}</h2>

          <label htmlFor="cajita-nombre" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            {COPY.cajitas.nombre}
          </label>
          <input
            id="cajita-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={esCuenta ? COPY.cuentas.nombrePlaceholder : COPY.cajitas.nombrePlaceholder}
            autoFocus
            className="mt-2 w-full rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-base font-medium text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
          />


          <label htmlFor="cajita-saldo" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            {esCuenta ? COPY.cuentas.saldoInicial : COPY.cajitas.saldoInicial}
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3">
            <span className="font-display text-xl font-extrabold text-[var(--fin-ink-faint)]">$</span>
            <input
              id="cajita-saldo"
              value={saldoTexto}
              onChange={(e) => setSaldoTexto(formatAmountInput(parseAmountInput(e.target.value)))}
              inputMode="numeric"
              placeholder="0"
              className="w-full bg-transparent font-display text-xl font-extrabold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
            {COPY.cajitas.saldoInicialHint}
          </p>

          <fieldset className="mt-4">
            <legend className="text-xs font-bold text-[var(--fin-ink-soft)]">Ícono</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CAJITA_ICONS.map((option: string) => {
                const IconComponent = iconoDeCajita(option);
                return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setIcon(option)}
                  aria-pressed={icon === option}
                  aria-label={`Ícono ${option}`}
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl border-2 transition-colors ${
                    icon === option
                      ? 'border-[var(--fin-ink)] bg-[var(--fin-soft)] text-[var(--fin-ink)]'
                      : 'border-[var(--fin-line)] bg-[var(--fin-card)] text-[var(--fin-ink-soft)]'
                  }`}
                >
                  <IconComponent className="h-5 w-5" />
                </button>
              )})}
            </div>
          </fieldset>

          {!esCuenta ? (
            <>
          <label htmlFor="cajita-meta" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            {COPY.cajitas.metaOpcional}
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3">
            <span className="font-display text-xl font-extrabold text-[var(--fin-ink-faint)]">$</span>
            <input
              id="cajita-meta"
              value={metaTexto}
              onChange={(e) => setMetaTexto(formatAmountInput(parseAmountInput(e.target.value)))}
              inputMode="numeric"
              placeholder="0"
              className="w-full bg-transparent font-display text-xl font-extrabold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            />
          </div>

            </>
          ) : null}

          {!esCuenta ? (
            <>
          <label htmlFor="cajita-tasa" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            {COPY.cajitas.tasaOpcional}
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3">
            <input
              id="cajita-tasa"
              value={tasaTexto}
              onChange={(e) => setTasaTexto(e.target.value.replace(/[^0-9.,]/g, ''))}
              inputMode="decimal"
              placeholder="13,5"
              className="w-full bg-transparent font-display text-xl font-extrabold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            />
            <span className="shrink-0 text-xs font-bold text-[var(--fin-ink-faint)]">% E.A.</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
            {COPY.cajitas.tasaHint}
          </p>

            </>
          ) : null}

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              disabled={nombre.trim() === ''}
              className="flex-1 rounded-full bg-[var(--fin-accent)] px-6 py-3.5 text-sm font-bold text-[var(--fin-on-accent)] disabled:opacity-30"
            >
              {esCuenta ? COPY.cajitas.crearCuenta : COPY.cajitas.crearCajita}
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
          {esCuenta ? COPY.cuentas.nueva : COPY.cajitas.nueva}
        </button>
      )}

      {/* Pockets */}
      {resumenes.length === 0 && !creando ? (
        <div className="rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-12 text-center flex flex-col items-center">
          <span className="block text-[var(--fin-ink-ghost)] mb-2 flex justify-center" aria-hidden="true">
            <PiggyBank className="h-10 w-10" strokeWidth={1.5} />
          </span>
          <p className="mt-3 text-sm font-bold text-[var(--fin-ink)]">{esCuenta ? COPY.cuentas.vacio : COPY.cajitas.vacio}</p>
          <p className="mt-1 text-xs text-[var(--fin-ink-faint)]">{esCuenta ? COPY.cuentas.vacioHint : COPY.cajitas.vacioHint}</p>
        </div>
      ) : null}

      {resumenes.map((resumen) => (
        <CajitaCard
          key={resumen.cajita.id}
          resumen={resumen}
          movimientos={movimientos}
          onFijarSaldo={onFijarSaldo}
          onMovimiento={onMovimiento}
          onEliminar={onEliminar}
        />
      ))}
    </div>
  );
};
