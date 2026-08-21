import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PiggyBank, Plus } from 'lucide-react';
import { COPY } from '../copy';
import { iconoDeCajita } from '../cajitaIconos';
import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento, CajitaMovKind, CajitaTipo } from '../data/modelos';
import { CAJITA_ICONS } from '../data/modelos';
import { resumenDeCajitas } from '../lib/cajitas';
import { formatAmountInput, conPuntos, formatCop, parseAmountInput } from '../lib/formatCop';
import { CajitaCard } from './CajitaCard';
import { RippleButton } from './RippleButton';

interface CajitasViewProps {
  /** Attributed ledger entries, so a balance reflects what was recorded. */
  transacciones: readonly Transaction[];
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
  /**
   * Whether savings count toward the summary. Only meaningful on the savings
   * screen — accounts are what the summary is *for*, so there is nothing to
   * switch off there.
   */
  /** Other balances money can be moved to. Excludes debts and cards. */
  destinos?: readonly { id: string; nombre: string }[];
  /** Bank accounts only — where a withdrawal lands. */
  cuentasBancarias?: readonly { id: string; nombre: string }[];
  onTransferir?: (datos: { origenId: string; destinoId: string; montoCop: number }) => void;
  mostrarEnResumen?: boolean;
  onMostrarEnResumen?: (valor: boolean) => void;
}

export const CajitasView: React.FC<CajitasViewProps> = ({
  tipo,
  transacciones,
  cajitas,
  movimientos,
  onCrear,
  onFijarSaldo,
  onMovimiento,
  onEliminar,
  destinos,
  cuentasBancarias,
  onTransferir,
  mostrarEnResumen = true,
  onMostrarEnResumen,
}) => {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [icon, setIcon] = useState<string>(CAJITA_ICONS[0]);
  const [saldoTexto, setSaldoTexto] = useState('');
  const [metaTexto, setMetaTexto] = useState('');
  const [tasaTexto, setTasaTexto] = useState('');

  const propias = cajitas.filter((c) => c.tipo === tipo);
  const resumenes = resumenDeCajitas(propias, movimientos, transacciones);
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
    // El total y el formulario de creación se quedan en una columna angosta
    // -- son lectura/entrada de un solo dato, no ganan nada con más ancho.
    // Las tarjetas de cajitas/cuentas sí: antes se apilaban una debajo de
    // otra hasta el fondo de la pantalla aunque hubiera sitio de sobra a los
    // lados, así que van en su propia grilla más ancha.
    // `w-full` es obligatorio -- ver el comentario en TendenciasView.tsx
    // sobre por qué un mx-auto sin w-full no llena dentro de un padre flex.
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        {/* Total across every live pocket */}
        <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
          <h2 className="text-[15px] font-semibold text-[var(--fin-ink-soft)]">
            <PiggyBank className="inline h-4 w-4 mr-1 mb-0.5" aria-hidden="true" />
            {esCuenta ? COPY.cuentas.total : COPY.cajitas.total}
          </h2>
          <p className="mt-1 text-[44px] font-semibold tabular-nums text-[var(--fin-ink)]">
            {formatCop(total)}
          </p>
          {resumenes.length > 0 ? (
            <p className="mt-1 text-[13px] text-[var(--fin-ink-faint)]">
              repartido en {resumenes.length} {esCuenta ? 'cuenta' : 'cajita'}
              {resumenes.length === 1 ? '' : 's'}
            </p>
          ) : null}

          {/* Sits under the savings total rather than in Configuración: the
 question is about this number, and the answer is easier to trust
 with the figure it changes in view.

 Gated on `tipo === 'cajita'` and not on "is not an account": this
 component also renders debts and cards, and the negated form would
 hang a savings switch under what you owe. */}
          {tipo === 'cajita' && onMostrarEnResumen ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-bg)] px-3.5 py-3">
              <span className="min-w-0">
                {/* The hint is `aria-describedby`, not part of the label. Inside
 it, the accessible name became the whole paragraph AND changed
 wording on every toggle — a control that renames itself when
 you use it is one a screen-reader user cannot keep track of. */}
                <label
                  htmlFor="ahorro-en-resumen"
                  className="block cursor-pointer text-[13px] font-semibold text-[var(--fin-ink)]"
                >
                  Contar las cajitas en el resumen
                </label>
                <span
                  id="ahorro-en-resumen-nota"
                  className="mt-0.5 block text-[13px] leading-relaxed text-[var(--fin-ink-faint)]"
                >
                  {mostrarEnResumen
                    ? 'Se suman a lo que tienes ahora.'
                    : 'El resumen muestra solo lo que hay en cuentas.'}
                </span>
              </span>
              {/* A plain checkbox, announced as one. It was marked
 role="switch" while still drawing as a square box, so the role
 promised a control the screen did not show. */}
              <input
                id="ahorro-en-resumen"
                type="checkbox"
                checked={mostrarEnResumen}
                onChange={(e) => onMostrarEnResumen(e.target.checked)}
                aria-describedby="ahorro-en-resumen-nota"
                className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--fin-accent)]"
              />
            </div>
          ) : null}
        </section>

        {/* Create */}
        <AnimatePresence initial={false}>
        {creando ? (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onSubmit={crear}
            className="overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
            <h2 className="text-[15px] font-semibold text-[var(--fin-ink-soft)]">
              {esCuenta ? COPY.cuentas.nueva : COPY.cajitas.nueva}
            </h2>

            <label
              htmlFor="cajita-nombre"
              className="mt-4 block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
            >
              {COPY.cajitas.nombre}
            </label>
            <input
              id="cajita-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={
                esCuenta ? COPY.cuentas.nombrePlaceholder : COPY.cajitas.nombrePlaceholder
              }
              autoFocus
              className="mt-2 w-full rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
            />

            <label
              htmlFor="cajita-saldo"
              className="mt-4 block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
            >
              {esCuenta ? COPY.cuentas.saldoInicial : COPY.cajitas.saldoInicial}
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3">
              <span className="text-[20px] font-semibold text-[var(--fin-ink-faint)]">$</span>
              <input
                id="cajita-saldo"
                value={saldoTexto}
                onChange={(e) => setSaldoTexto(conPuntos(e.target.value))}
                inputMode="numeric"
                placeholder="0"
                className="w-full bg-transparent text-[20px] font-semibold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
              />
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
              {COPY.cajitas.saldoInicialHint}
            </p>

            <fieldset className="mt-4">
              <legend className="text-[15px] font-semibold text-[var(--fin-ink-soft)]">
                Ícono
              </legend>
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
                      className={`flex h-10 w-10 items-center justify-center rounded-[var(--fin-r-card)] border-2 transition-colors ${
                        icon === option
                          ? 'border-[var(--fin-ink)] bg-[var(--fin-soft)] text-[var(--fin-ink)]'
                          : 'border-[var(--fin-line)] bg-[var(--fin-card)] text-[var(--fin-ink-soft)]'
                      }`}
                    >
                      <IconComponent className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {!esCuenta ? (
              <>
                <label
                  htmlFor="cajita-meta"
                  className="mt-4 block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
                >
                  {COPY.cajitas.metaOpcional}
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3">
                  <span className="text-[20px] font-semibold text-[var(--fin-ink-faint)]">$</span>
                  <input
                    id="cajita-meta"
                    value={metaTexto}
                    onChange={(e) =>
                      setMetaTexto(formatAmountInput(parseAmountInput(e.target.value)))
                    }
                    inputMode="numeric"
                    placeholder="0"
                    className="w-full bg-transparent text-[20px] font-semibold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
                  />
                </div>
              </>
            ) : null}

            {!esCuenta ? (
              <>
                <label
                  htmlFor="cajita-tasa"
                  className="mt-4 block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
                >
                  {COPY.cajitas.tasaOpcional}
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3">
                  <input
                    id="cajita-tasa"
                    value={tasaTexto}
                    onChange={(e) => setTasaTexto(e.target.value.replace(/[^0-9.,]/g, ''))}
                    inputMode="decimal"
                    placeholder="13,5"
                    className="w-full bg-transparent text-[20px] font-semibold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
                  />
                  <span className="shrink-0 text-[15px] font-semibold text-[var(--fin-ink-faint)]">
                    % E.A.
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
                  {COPY.cajitas.tasaHint}
                </p>
              </>
            ) : null}

            <div className="mt-5 flex gap-2">
              <RippleButton
                type="submit"
                disabled={nombre.trim() === ''}
                rippleColor="rgba(255,255,255,0.5)"
                className="flex-1 rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-6 py-3.5 text-[17px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-30"
              >
                {esCuenta ? COPY.cajitas.crearCuenta : COPY.cajitas.crearCajita}
              </RippleButton>
              <button
                type="button"
                onClick={() => setCreando(false)}
                className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-6 py-3.5 text-[17px] font-semibold text-[var(--fin-ink-soft)]"
              >
                {COPY.confirm.cancel}
              </button>
            </div>
          </motion.form>
        ) : (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] border-2 border-dashed border-[var(--fin-line)] px-6 py-4 text-[17px] font-semibold text-[var(--fin-ink-soft)] transition-colors hover:border-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
          >
            <Plus className="h-4 w-4" strokeWidth={3} />
            {esCuenta ? COPY.cuentas.nueva : COPY.cajitas.nueva}
          </button>
        )}
        </AnimatePresence>

        {/* Pockets */}
        {resumenes.length === 0 && !creando ? (
          <div className="rounded-[var(--fin-r-card)] border-2 border-dashed border-[var(--fin-line)] px-6 py-12 text-center flex flex-col items-center">
            <span
              className="block text-[var(--fin-ink-ghost)] mb-2 flex justify-center"
              aria-hidden="true"
            >
              <PiggyBank className="h-10 w-10" strokeWidth={1.5} />
            </span>
            <p className="mt-3 text-[17px] font-semibold text-[var(--fin-ink)]">
              {esCuenta ? COPY.cuentas.vacio : COPY.cajitas.vacio}
            </p>
            <p className="mt-1 text-[15px] text-[var(--fin-ink-faint)]">
              {esCuenta ? COPY.cuentas.vacioHint : COPY.cajitas.vacioHint}
            </p>
          </div>
        ) : null}
      </div>

      {resumenes.length > 0 ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {resumenes.map((resumen) => (
            <CajitaCard
              key={resumen.cajita.id}
              resumen={resumen}
              movimientos={movimientos}
              onFijarSaldo={onFijarSaldo}
              onMovimiento={onMovimiento}
              onEliminar={onEliminar}
              destinos={destinos}
              cuentasBancarias={cuentasBancarias}
              onTransferir={onTransferir}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};
