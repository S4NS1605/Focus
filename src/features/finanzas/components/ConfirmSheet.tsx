import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Ear,
  CheckCircle2,
  User,
  MapPin,
  Tag,
} from 'lucide-react';
import { tint } from '../types';
import type { CategoriaClave, Transaction } from '../types';
import type { TxKind } from '../types';
import { COPY } from '../copy';
import { formatAmountInput, formatCop, parseAmountInput } from '../lib/formatCop';
import type { ParsedTransaction } from '../lib/parseTransaction';
import { analizarAnomalias } from '../lib/senalesAvanzadas';
import { useBloqueoScroll } from '../data/useBloqueoScroll';
import { useCatalogo } from '../catalogoContexto';

export interface ConfirmDraft {
  kind: TxKind;
  amountCop: number;
  category: CategoriaClave;
  description: string;
  /** Null when the user does not say where the money moved. */
  cuentaId: string | null;
  rawTranscript: string;
  /**
   * El día del movimiento (YYYY-MM-DD). Solo lo llena la edición: al crear, la
   * fecha es hoy y la pone quien guarda, no este formulario.
   */
  occurredOn?: string;
}

interface ConfirmSheetProps {
  parsed: ParsedTransaction;
  onSave: (draft: ConfirmDraft) => void;
  onCancel: () => void;
  /**
   * Editing reuses this whole form rather than duplicating it. The only
   * differences are wording and which field gets initial focus — the fields,
   * validation and category picker are identical, and keeping one component
   * means a fix to the amount parser can never apply to only one of the two.
   */
  modo?: 'crear' | 'editar';
  /** Accounts and pockets the money could have moved through. */
  cuentas?: readonly { id: string; nombre: string }[];
  cuentaInicial?: string | null;
  /** El día que ya tiene el movimiento; abre el selector de fecha al editar. */
  fechaInicial?: string;
  /** Tope del selector: no se puede fechar un movimiento en el futuro. */
  fechaMax?: string;
  /**
   * El libro completo, para avisar si el monto se sale de lo usual en esta
   * categoría. Opcional porque es puramente informativo — sin esto el
   * formulario sigue funcionando igual, solo no muestra el aviso.
   */
  transacciones?: readonly Transaction[];
}

/**
 * Always shown, even at high confidence. Confidence controls PRESENTATION only —
 * which field is highlighted and focused — never whether the write happens. That
 * removes the entire class of "silently saved the wrong number" bugs for the cost
 * of one tap.
 */
export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({
  parsed,
  onSave,
  onCancel,
  modo = 'crear',
  cuentas = [],
  cuentaInicial = null,
  fechaInicial,
  fechaMax,
  transacciones,
}) => {
  const editando = modo === 'editar';
  const [amountText, setAmountText] = useState(() => formatAmountInput(parsed.amount));
  const [fecha, setFecha] = useState(fechaInicial ?? parsed.dateOverride ?? '');
  const [kind, setKind] = useState<TxKind>(parsed.kind);
  const [category, setCategory] = useState<CategoriaClave>(parsed.category);
  const [description, setDescription] = useState(parsed.description);
  // `cuentaInicial` gana porque es la del movimiento que se está editando; si no
  // hay ninguna, se usa la que el texto nombró ("me transfirieron 20 mil a
  // Bancolombia").
  const [cuentaId, setCuentaId] = useState<string | null>(cuentaInicial ?? parsed.cuentaId);

  const amountRef = useRef<HTMLInputElement>(null);

  // An edit starts from a value the user already confirmed once, so nothing is
  // "weak" — highlighting fields amber here would imply the app doubts data it
  // has no reason to doubt.
  const amountWeak = !editando && parsed.signals.amountSource === 'none';
  const kindWeak = !editando && parsed.signals.kindSource === 'default';
  const amountCop = parseAmountInput(amountText);

  // Se recalcula con el monto y la categoría EN PANTALLA, no los que trajo el
  // parser: si la persona corrige cualquiera de los dos antes de guardar, el
  // aviso tiene que reflejar lo que de verdad se va a guardar. Solo al crear —
  // al editar un movimiento ya guardado no tiene sentido advertir sobre algo
  // que la persona ya vivió y confirmó una vez.
  const anomalia = useMemo(
    () =>
      !editando && transacciones && amountCop && amountCop > 0
        ? analizarAnomalias(transacciones, category, amountCop)
        : null,
    [editando, transacciones, category, amountCop],
  );

  useBloqueoScroll(true);
  const catalogo = useCatalogo();

  useEffect(() => {
    if (amountWeak) amountRef.current?.focus();
  }, [amountWeak]);

  // The archived category a movement is already filed under stays selectable,
  // so opening an old movement to fix its amount cannot silently re-file it.
  const opciones = catalogo.lista.some((c) => c.clave === category)
    ? catalogo.lista
    : [...catalogo.lista, catalogo.de(category)];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amountCop === null) {
      amountRef.current?.focus();
      return;
    }
    onSave({
      kind,
      amountCop,
      category,
      description: description.trim() || catalogo.de(category).nombre,
      cuentaId,
      rawTranscript: parsed.raw,
      // Solo viaja si el selector está en juego (edición) o si el motor de texto extrajo una fecha
      occurredOn:
        (fechaInicial !== undefined || parsed.dateOverride) && fecha !== ''
          ? fecha
          : parsed.dateOverride,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-40 flex items-end justify-center bg-[var(--fin-scrim)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={editando ? COPY.confirm.titleEditar : COPY.confirm.title}
    >
      <motion.form
        onSubmit={handleSubmit}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[var(--fin-r-sheet)] bg-[var(--fin-card)] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-[var(--fin-ink)]">
              {(() => {
                const Icon = catalogo.de(category).Icono;
                return <Icon className="h-6 w-6 mr-1" aria-hidden="true" />;
              })()}
              {editando ? COPY.confirm.titleEditar : COPY.confirm.title}
            </h2>
            {!editando && parsed.needsReview ? (
              <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--fin-warn)]">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={3} />
                {COPY.confirm.review}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={COPY.confirm.cancel}
            className="rounded-[var(--fin-r-control)] p-1.5 text-[var(--fin-ink-faint)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>

        {/* Amount */}
        <div className="mt-5">
          <label
            htmlFor="fin-amount"
            className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
          >
            {COPY.confirm.amount}
          </label>
          <div
            className="mt-2 flex items-center gap-2 rounded-[var(--fin-r-card)] border-2 bg-[var(--fin-card)] px-4 py-3"
            style={{ borderColor: amountWeak ? 'var(--fin-warn)' : 'var(--fin-line)' }}
          >
            <span className="text-[28px] font-semibold text-[var(--fin-ink-faint)]">$</span>
            <input
              id="fin-amount"
              ref={amountRef}
              value={amountText}
              onChange={(e) => setAmountText(formatAmountInput(parseAmountInput(e.target.value)))}
              inputMode="numeric"
              placeholder="0"
              className="w-full bg-transparent text-[28px] font-semibold text-[var(--fin-ink)] tabular-nums placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            />
          </div>
          {amountWeak ? (
            <p className="mt-1.5 text-[13px] font-semibold text-[var(--fin-warn)]">
              {COPY.confirm.amountMissing}
            </p>
          ) : anomalia?.esAnomalía ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--fin-warn)]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />
              Fuera de lo usual — sueles gastar {formatCop(anomalia.promedio)} en esta categoría.
            </p>
          ) : null}
        </div>

        {/* Direction */}
        <fieldset className="mt-5">
          <legend className="text-[15px] font-semibold text-[var(--fin-ink-soft)]">
            {COPY.confirm.kind}
          </legend>
          <div
            className="mt-2 grid grid-cols-2 gap-2 rounded-[var(--fin-r-card)] border-2 bg-[var(--fin-card)] p-1.5"
            style={{ borderColor: kindWeak ? 'var(--fin-warn)' : 'var(--fin-line)' }}
          >
            {(
              [
                {
                  value: 'gasto',
                  icon: ArrowDownCircle,
                  label: COPY.confirm.gasto,
                  on: 'var(--fin-out-bg)',
                  ink: 'var(--fin-out)',
                },
                {
                  value: 'ingreso',
                  icon: ArrowUpCircle,
                  label: COPY.confirm.ingreso,
                  on: 'var(--fin-in-bg)',
                  ink: 'var(--fin-in)',
                },
              ] as const
            ).map((option) => {
              const active = kind === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  aria-pressed={active}
                  className="flex items-center justify-center gap-1.5 rounded-[var(--fin-r-control)] px-4 py-2.5 text-[17px] font-semibold transition-colors"
                  style={{
                    backgroundColor: active ? option.on : 'transparent',
                    color: active ? option.ink : 'var(--fin-ink-faint)',
                  }}
                >
                  <option.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Category: Visual grid of colorful buttons */}
        <fieldset className="mt-5">
          <legend className="text-[15px] font-semibold text-[var(--fin-ink-soft)]">
            {COPY.confirm.category}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {opciones.map((entrada) => {
              const option = entrada.clave;
              const active = category === option;
              const color = entrada.color;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  aria-pressed={active}
                  className="flex items-center gap-1.5 rounded-[var(--fin-r-pill)] border-2 px-3 py-2 text-[15px] font-semibold transition-colors"
                  style={{
                    backgroundColor: active ? tint(color, 0.16) : 'var(--fin-card)',
                    borderColor: active ? color : 'var(--fin-line)',
                    color: active ? 'var(--fin-ink)' : 'var(--fin-ink-soft)',
                  }}
                >
                  {(() => {
                    const Icon = entrada.Icono;
                    return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
                  })()}
                  {entrada.nombre}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Signals Extracted */}
        {!editando &&
        (parsed.signals.destinatario ||
          parsed.signals.ubicacion ||
          parsed.signals.tags?.length > 0) ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {parsed.signals.destinatario && (
              <span className="inline-flex items-center gap-1 rounded bg-[var(--fin-soft)] px-2 py-1 text-[13px] font-semibold text-[var(--fin-ink-soft)]">
                <User className="h-3 w-3" strokeWidth={2.5} /> {parsed.signals.destinatario}
              </span>
            )}
            {parsed.signals.ubicacion && (
              <span className="inline-flex items-center gap-1 rounded bg-[var(--fin-soft)] px-2 py-1 text-[13px] font-semibold text-[var(--fin-ink-soft)]">
                <MapPin className="h-3 w-3" strokeWidth={2.5} /> {parsed.signals.ubicacion}
              </span>
            )}
            {parsed.signals.tags?.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded bg-[var(--fin-soft)] px-2 py-1 text-[13px] font-semibold text-[var(--fin-ink-soft)]"
              >
                <Tag className="h-3 w-3" strokeWidth={2.5} /> {t}
              </span>
            ))}
          </div>
        ) : null}

        {/* Which balance this moved. Optional, and last: the fast path is
 dictate-and-confirm, so anything that is not needed to record the
 movement correctly must not stand between the user and saving. */}
        {cuentas.length > 0 ? (
          <div className="mt-5">
            <label
              htmlFor="fin-cuenta"
              className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
            >
              {kind === 'ingreso' ? COPY.confirm.cuentaIngreso : COPY.confirm.cuenta}
            </label>
            <select
              id="fin-cuenta"
              value={cuentaId ?? ''}
              onChange={(e) => setCuentaId(e.target.value || null)}
              className="mt-2 w-full rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
            >
              <option value="">{COPY.confirm.sinCuenta}</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
              {COPY.confirm.cuentaHint}
            </p>
          </div>
        ) : null}

        {/* Description */}
        <div className="mt-5">
          <label
            htmlFor="fin-desc"
            className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
          >
            {COPY.confirm.description}
          </label>
          <input
            id="fin-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
          />
        </div>

        {/* Fecha — solo al editar o si el motor extrajo una fecha (ayer, hoy). Un movimiento nuevo es de hoy por definición;
 corregir el día de uno viejo (lo registré tarde, cayó en otra fecha)
 es justo lo que aquí faltaba poder hacer. */}
        {fechaInicial !== undefined || parsed.dateOverride ? (
          <div className="mt-5">
            <label
              htmlFor="fin-fecha"
              className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
            >
              {COPY.confirm.fecha}
            </label>
            <input
              id="fin-fecha"
              type="date"
              value={fecha}
              max={fechaMax}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-2 w-full rounded-[var(--fin-r-card)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
            />
          </div>
        ) : null}

        {/* What was actually heard, so a mis-parse is always traceable */}
        {parsed.raw.trim() ? (
          <p className="mt-4 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] px-4 py-3 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
            <Ear className="inline h-4 w-4 mr-1 mb-0.5" aria-hidden="true" />
            <span className="font-semibold">{COPY.confirm.heard}: </span>
            &ldquo;{parsed.raw.trim()}&rdquo;
          </p>
        ) : null}

        {/* Actions */}
        <motion.button
          type="submit"
          disabled={amountCop === null}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-6 py-4 text-[17px] font-semibold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)] disabled:opacity-30"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          {editando ? COPY.confirm.saveEditar : COPY.confirm.save}
        </motion.button>
      </motion.form>
    </motion.div>
  );
};
