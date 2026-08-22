import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Camera, Check, ChevronDown, Keyboard, Sparkles, Wallet, X } from 'lucide-react';
import { tint } from '../types';
import type { CategoriaClave, TxKind } from '../types';
import type { Cajita } from '../data/modelos';
import { iconoDeCajita } from '../cajitaIconos';
import { formatAmountInput } from '../lib/formatCop';
import type { ParsedTransaction } from '../lib/parseTransaction';
import { useBloqueoScroll } from '../data/useBloqueoScroll';
import { useCatalogo } from '../catalogoContexto';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import { TecladoNumerico } from './TecladoNumerico';
import { AnimatedNumber } from './AnimatedNumber';
import { RippleButton } from './RippleButton';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import type { ConfirmDraft } from './ConfirmSheet';

interface CapturaProps {
  /** Lo que el motor de texto entendió de lo que dijiste. */
  parsed: ParsedTransaction;
  cajitas?: readonly Cajita[];
  onSave: (draft: ConfirmDraft) => void;
  onCancel: () => void;
  /** Se llama al tocar el botón de la foto del recibo. */
  onFoto?: () => void;
  /**
   * La cuenta que se usa cuando no dices ninguna.
   */
  cuentaPorDefecto?: string | null;
  /** Marca si es la primera prueba por micrófono del onboarding. */
  esPrimeraPrueba?: boolean;
}

/**
 * La pantalla de anotar un gasto / ingreso rápido.
 *
 * Incluye selección clara de Gasto vs Ingreso, selector desplegable de cuentas/bancos,
 * y categorización automática optimizada.
 */
export const Captura: React.FC<CapturaProps> = ({
  parsed,
  cajitas = [],
  onSave,
  onCancel,
  onFoto,
  cuentaPorDefecto = null,
  esPrimeraPrueba = false,
}) => {
  const [digitos, setDigitos] = useState(() =>
    parsed.amount === null ? '' : String(Math.round(parsed.amount)),
  );
  const [kind, setKind] = useState<TxKind>(parsed.kind);
  const [category, setCategory] = useState<CategoriaClave>(parsed.category);
  const [description, setDescription] = useState(parsed.description);
  const [editandoTexto, setEditandoTexto] = useState(false);
  const [desplegarCuentas, setDesplegarCuentas] = useState(false);

  // Cuentas disponibles activas
  const cuentasActivas = useMemo(() => cajitas.filter((c) => !c.archivedAt), [cajitas]);

  const [cuentaId, setCuentaId] = useState<string | null>(() => {
    if (parsed.cuentaId) return parsed.cuentaId;
    if (cuentaPorDefecto && cuentasActivas.some((c) => c.id === cuentaPorDefecto)) return cuentaPorDefecto;
    return cuentasActivas[0]?.id ?? null;
  });

  const cuentaSeleccionada = useMemo(
    () => cuentasActivas.find((c) => c.id === cuentaId) ?? null,
    [cuentasActivas, cuentaId],
  );

  const descRef = useRef<HTMLTextAreaElement>(null);
  const capturaRef = useRef<HTMLDivElement>(null);
  const catalogo = useCatalogo();
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();

  useSwipeGesture(capturaRef as React.RefObject<HTMLElement>, {
    onSwipeRight: () => {
      haptic.trigger('light');
      audio.play('click');
      onCancel();
    },
  });

  useBloqueoScroll(true);

  const amountCop = digitos === '' ? null : Number(digitos);
  const esGasto = kind === 'gasto';

  const opciones = useMemo(() => {
    const lista = catalogo.lista.some((c) => c.clave === category)
      ? catalogo.lista
      : [...catalogo.lista, catalogo.de(category)];
    return [...lista].sort((a, b) => (a.clave === category ? -1 : b.clave === category ? 1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo]);

  const escribirDigitos = (nuevos: string) => {
    setDigitos((prev) => (prev + nuevos).replace(/^0+(?=\d)/, '').slice(0, 12));
  };

  const guardar = () => {
    if (amountCop === null || amountCop === 0) {
      haptic.trigger('error');
      audio.play('error');
      return;
    }
    haptic.trigger('success');
    audio.play('success');
    onSave({
      kind,
      amountCop,
      category,
      description: description.trim() || catalogo.de(category).nombre,
      cuentaId: cuentaId ?? parsed.cuentaId ?? cuentaPorDefecto,
      rawTranscript: parsed.raw,
      occurredOn: parsed.dateOverride,
    });
  };

  const colorMonto = esGasto ? 'var(--fin-out)' : 'var(--fin-in)';
  const IconoCuenta = cuentaSeleccionada ? iconoDeCajita(cuentaSeleccionada.icon) : Wallet;

  return (
    <motion.div
      ref={capturaRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--fin-bg)] px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Anotar un movimiento"
    >
      {/* Banner de primera prueba por micrófono */}
      {esPrimeraPrueba ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3.5 flex items-start gap-2.5 rounded-[var(--fin-r-card)] border border-amber-500/35 bg-amber-500/10 p-3.5 text-[13px] text-amber-500 shadow-sm backdrop-blur-md"
        >
          <Sparkles className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-400" />
          <div className="leading-snug">
            <span className="font-bold">🎤 ¡Esta es tu primera prueba por voz!</span>
            <p className="mt-1 text-[12px] opacity-90">
              Di una frase como <em>«gasté 20 mil en almuerzo»</em>. Este registro es una prueba temporal para que conozcas la app y podrás editarlo o borrarlo fácilmente con un toque.
            </p>
          </div>
        </motion.div>
      ) : null}

      {/* Cabecera superior con Fecha, Selector Plegable de Banco/Cuenta, Selector Gasto/Ingreso y Cerrar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Fecha */}
          <span className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--fin-ink-soft)]">
            {parsed.dateOverride
              ? parsed.dateOverride.slice(8) + '/' + parsed.dateOverride.slice(5, 7)
              : 'Hoy'}
          </span>

          {/* Toggle Gasto / Ingreso intuitivo */}
          <div className="flex items-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] p-0.5">
            <button
              type="button"
              onClick={() => {
                haptic.trigger('selection');
                audio.play('selection');
                setKind('gasto');
              }}
              className={`flex items-center gap-1 rounded-[var(--fin-r-pill)] px-2.5 py-1 text-[12px] font-bold transition-all ${
                esGasto
                  ? 'bg-[var(--fin-out)] text-white shadow-sm'
                  : 'text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink-soft)]'
              }`}
            >
              <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              Gasto
            </button>
            <button
              type="button"
              onClick={() => {
                haptic.trigger('selection');
                audio.play('selection');
                setKind('ingreso');
              }}
              className={`flex items-center gap-1 rounded-[var(--fin-r-pill)] px-2.5 py-1 text-[12px] font-bold transition-all ${
                !esGasto
                  ? 'bg-[var(--fin-in)] text-white shadow-sm'
                  : 'text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink-soft)]'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              Ingreso
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          aria-label="Cerrar sin guardar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
        >
          <X className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      {/* Selector Plegable de Banco / Cuenta */}
      {cuentasActivas.length > 0 && (
        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => setDesplegarCuentas(!desplegarCuentas)}
            className="flex items-center gap-2 rounded-[var(--fin-r-pill)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--fin-ink)] shadow-sm transition-all hover:bg-[var(--fin-soft)]"
          >
            <IconoCuenta className="h-4 w-4 shrink-0 text-[var(--fin-ink-soft)]" />
            <span className="truncate max-w-[160px]">
              {cuentaSeleccionada ? cuentaSeleccionada.nombre : 'Seleccionar cuenta'}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-[var(--fin-ink-faint)] transition-transform duration-200 ${
                desplegarCuentas ? 'rotate-180' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {desplegarCuentas && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full z-50 mt-2 min-w-[240px] rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-2 shadow-2xl backdrop-blur-xl"
                style={{ backgroundColor: 'var(--fin-surface)' }}
              >
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]">
                  Cuenta / Banco
                </p>
                <div className="mt-1 flex flex-col gap-1 max-h-52 overflow-y-auto">
                  {cuentasActivas.map((c) => {
                    const Icon = iconoDeCajita(c.icon);
                    const activa = c.id === cuentaId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          haptic.trigger('selection');
                          audio.play('selection');
                          setCuentaId(c.id);
                          setDesplegarCuentas(false);
                        }}
                        className={`flex items-center justify-between rounded-[var(--fin-r-control)] px-3 py-2.5 text-left text-[14px] transition-colors ${
                          activa
                            ? 'bg-[var(--fin-soft)] font-bold text-[var(--fin-ink)]'
                            : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]/60 hover:text-[var(--fin-ink)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon className="h-4 w-4 shrink-0 text-[var(--fin-ink-soft)]" />
                          <span className="truncate">{c.nombre}</span>
                        </div>
                        {activa && <Check className="h-4 w-4 shrink-0 text-[var(--fin-accent)]" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* El centro: Monto y Descripción */}
      <div className="mt-6 min-h-0 flex-1">
        <div
          className="tabular-nums"
          style={{
            font: 'var(--fin-t-cifra)',
            letterSpacing: 'var(--fin-track-cifra)',
            color: amountCop === null ? 'var(--fin-ink-ghost)' : colorMonto,
          }}
        >
          {esGasto ? '−' : '+'}$
          <AnimatedNumber
            value={amountCop}
            format={(n) => formatAmountInput(n)}
          />
        </div>

        {editandoTexto ? (
          <textarea
            ref={descRef}
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => setEditandoTexto(false)}
            aria-label="Descripción"
            className="mt-3 w-full max-h-32 resize-none bg-transparent text-[20px] font-normal text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            placeholder="¿En qué fue? Cuéntame con detalles..."
            rows={3}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditandoTexto(true)}
            className="mt-3 block w-full truncate text-left text-[26px] font-normal text-[var(--fin-ink)]"
          >
            {description.trim() || (
              <span className="text-[var(--fin-ink-ghost)]">¿En qué fue?</span>
            )}
          </button>
        )}

        {/* Las categorías en carrusel horizontal */}
        <div
          data-no-swipe
          className="-mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {opciones.map((entrada) => {
            const activa = category === entrada.clave;
            const Icono = entrada.Icono;
            return (
              <button
                key={entrada.clave}
                type="button"
                onClick={() => {
                  haptic.trigger('selection');
                  audio.play('selection');
                  setCategory(entrada.clave);
                }}
                aria-pressed={activa}
                className="flex shrink-0 items-center gap-2 rounded-[var(--fin-r-pill)] px-4 py-2.5 text-[15px] font-semibold transition-colors"
                style={{
                  backgroundColor: activa ? tint(entrada.color, 0.18) : 'var(--fin-soft)',
                  color: activa ? 'var(--fin-ink)' : 'var(--fin-ink-soft)',
                }}
              >
                <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
                {entrada.nombre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Abajo: Teclado numérico y guardar */}
      <div className="mt-6 flex flex-col gap-3">
        <TecladoNumerico
          onDigito={escribirDigitos}
          onBorrar={() => setDigitos((prev) => prev.slice(0, -1))}
        />

        <div className="flex items-center gap-2">
          {onFoto ? (
            <button
              type="button"
              onClick={onFoto}
              aria-label="Foto del recibo"
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
            >
              <Camera className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setEditandoTexto(true)}
            aria-label="Escribir la descripción"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
          >
            <Keyboard className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>

          <RippleButton
            type="button"
            onClick={guardar}
            disabled={amountCop === null || amountCop === 0}
            rippleColor="rgba(255,255,255,0.5)"
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] text-[17px] font-semibold text-[var(--fin-on-accent)] transition-opacity disabled:opacity-30"
          >
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            Guardar
          </RippleButton>
        </div>
      </div>
    </motion.div>
  );
};

