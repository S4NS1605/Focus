import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Check, Keyboard, X } from 'lucide-react';
import { tint } from '../types';
import type { CategoriaClave, TxKind } from '../types';
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
  onSave: (draft: ConfirmDraft) => void;
  onCancel: () => void;
  /** Se llama al tocar el botón de la foto del recibo. */
  onFoto?: () => void;
  /**
   * La cuenta que se usa cuando no dices ninguna. Antes esto era un desplegable
   * en pantalla; ahora se pone solo y se corrige después si hizo falta.
   */
  cuentaPorDefecto?: string | null;
}

/**
 * La pantalla de anotar un gasto.
 *
 * Antes esto era un formulario de 914px con 17 botones y 6 campos con etiqueta,
 * y el botón de Guardar nacía fuera de la pantalla: siempre tocaba hacer scroll.
 * Y lo curioso es que el motor de texto casi siempre ya había acertado todo.
 *
 * Así que aquí no hay campos: hay un monto grande y una descripción grande, que
 * son lo único que de verdad importa mirar antes de guardar. Todo lo demás
 * (la cuenta, la fecha, el tipo) se pone solo y se corrige tocándolo.
 *
 * Lo que NO cambia: sigues viendo el número antes de que se guarde. Esa regla
 * era la razón de existir de la pantalla vieja y se conserva entera — lo que se
 * quitó fue la sensación de estar llenando un formulario, no el paso de revisar.
 */
export const Captura: React.FC<CapturaProps> = ({
  parsed,
  onSave,
  onCancel,
  onFoto,
  cuentaPorDefecto = null,
}) => {
  // El monto se guarda como una cadena de dígitos ('45000') y se formatea solo
  // al pintarlo. Así el teclado nuestro solo tiene que pegar y quitar letras.
  const [digitos, setDigitos] = useState(() =>
    parsed.amount === null ? '' : String(Math.round(parsed.amount)),
  );
  const [kind, setKind] = useState<TxKind>(parsed.kind);
  const [category, setCategory] = useState<CategoriaClave>(parsed.category);
  const [description, setDescription] = useState(parsed.description);
  const [editandoTexto, setEditandoTexto] = useState(false);

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

  // La categoría que adivinó el motor va de primera, para que casi nunca haya
  // que deslizar la fila. Si acertó, ya está puesta y no se toca nada.
  const opciones = useMemo(() => {
    const lista = catalogo.lista.some((c) => c.clave === category)
      ? catalogo.lista
      : [...catalogo.lista, catalogo.de(category)];
    return [...lista].sort((a, b) => (a.clave === category ? -1 : b.clave === category ? 1 : 0));
    // Solo se reordena al abrir: si se recalculara con cada toque, las pastillas
    // saltarían de sitio bajo el dedo justo al elegir una.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo]);

  const escribirDigitos = (nuevos: string) => {
    // Tope de 12 dígitos: más que eso no es un gasto, es un dedo trabado.
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
      // Si la persona no escribió nada, el nombre de la categoría es mejor
      // etiqueta que una fila en blanco.
      description: description.trim() || catalogo.de(category).nombre,
      cuentaId: parsed.cuentaId ?? cuentaPorDefecto,
      rawTranscript: parsed.raw,
      occurredOn: parsed.dateOverride,
    });
  };

  const colorMonto = esGasto ? 'var(--fin-out)' : 'var(--fin-in)';

  return (
    <motion.div
      ref={capturaRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--fin-bg)] px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      role="dialog"
      aria-modal="true"
      aria-label="Anotar un movimiento"
    >
      {/* Arriba: los datos que casi nunca se cambian, en pastillas diminutas.
 No son campos de formulario porque no son decisiones: son cosas que ya
 están bien y que uno solo toca cuando algo salió raro. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-1.5 text-[13px] text-[var(--fin-ink-soft)]">
            {parsed.dateOverride
              ? parsed.dateOverride.slice(8) + '/' + parsed.dateOverride.slice(5, 7)
              : 'Hoy'}
          </span>
          <button
            type="button"
            onClick={() => {
              haptic.trigger('selection');
              audio.play('selection');
              setKind(esGasto ? 'ingreso' : 'gasto');
            }}
            className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-1.5 text-[13px] font-semibold transition-colors"
            style={{ color: colorMonto }}
          >
            {esGasto ? 'Gasto' : 'Ingreso'}
          </button>
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

      {/* El centro: el monto y la descripción. No llevan etiqueta ni caja porque
 son lo único que hay en pantalla — no hace falta decir "Monto" encima
 de un número gigante. */}
      <div className="mt-8 min-h-0 flex-1">
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
            className="mt-3 block w-full truncate text-left text-[28px] font-normal text-[var(--fin-ink)]"
          >
            {description.trim() || (
              <span className="text-[var(--fin-ink-ghost)]">¿En qué fue?</span>
            )}
          </button>
        )}

        {/* Las categorías, en una fila que se desliza. La adivinada va primero y
 ya viene puesta, así que lo normal es no tocar nada aquí.
 `data-no-swipe`: sin esto, deslizar la fila para ver más categorías es
 indistinguible del swipe-para-cancelar que cierra toda la hoja (ambos
 gestos viven en el mismo `capturaRef`). `useSwipeGesture` ya sabe
 ignorar cualquier toque que empiece dentro de una zona marcada así —
 ver ese hook para el porqué no basta con un stopPropagation normal. */}
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

      {/* Abajo: el teclado y guardar, al alcance del pulgar. */}
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
