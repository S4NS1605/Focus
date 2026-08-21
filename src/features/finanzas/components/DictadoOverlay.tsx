import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, AlertTriangle } from 'lucide-react';
import { COPY } from '../copy';

export type FaseDictado = 'escuchando' | 'procesando' | 'revelando' | 'error';

interface DictadoOverlayProps {
  abierto: boolean;
  fase: FaseDictado;
  /** 0 a 1. Mueve el pulso mientras se escucha; el resto del tiempo se ignora. */
  nivelAudio: number;
  /** El texto ya transcrito, listo para revelarse palabra por palabra. */
  texto: string;
  error?: string | null;
  onCancelar: () => void;
  /** "Ya terminé de hablar": corta la grabación y pasa a transcribir. */
  onConfirmar: () => void;
  /** Se llama sola cuando la última palabra terminó de aparecer en pantalla. */
  onRevelado: () => void;
}

/**
 * La pantalla completa que se abre al tocar el micrófono.
 *
 * Antes "escuchando" era un círculo rojo latiendo en una barra flotante de
 * 64px -- se sentía como si el toque solo hubiera activado un interruptor, no
 * como si la app estuviera de verdad escuchando. Ahora, mientras se graba,
 * `useAudioCapture` manda el audio acumulado a transcribir cada ~1.6s (ver
 * `INTERVALO_PARCIAL_MS` ahí) y este componente va mostrando esa respuesta
 * creciente palabra por palabra -- no es una conexión en vivo a un motor de
 * voz en streaming, es Groq respondiendo rapidísimo una y otra vez con un
 * trozo más largo cada vez, pero el resultado en pantalla es el mismo que
 * buscaba: el texto aparece mientras se habla, no de golpe al final.
 *
 * Por eso `texto` sirve para dos cosas con el mismo tratamiento visual: el
 * parcial que va creciendo mientras se escucha, y la versión definitiva que
 * Whisper confirma al soltar el botón (fase "revelando"). Solo esta última
 * dispara `onRevelado` -- el parcial cambia todo el tiempo y nunca debe
 * avanzar la pantalla solo.
 */
export const DictadoOverlay: React.FC<DictadoOverlayProps> = ({
  abierto,
  fase,
  nivelAudio,
  texto,
  error,
  onCancelar,
  onConfirmar,
  onRevelado,
}) => {
  const palabras = useMemo(() => texto.trim().split(/\s+/).filter(Boolean), [texto]);

  // Cuánto se demora cada palabra en aparecer: rápido para una frase corta,
  // pero nunca tan lento que una frase larga tarde una eternidad en revelarse.
  const stagger = useMemo(() => Math.min(0.05, 1.1 / Math.max(1, palabras.length)), [palabras.length]);

  useEffect(() => {
    if (fase !== 'revelando' || palabras.length === 0) return;
    const totalMs = (palabras.length * stagger + 0.55) * 1000;
    const t = setTimeout(onRevelado, totalMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, texto]);

  return (
    <AnimatePresence>
      {abierto ? (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="fin-dictado-bg pointer-events-auto fixed inset-0 z-50 flex flex-col overflow-hidden rounded-t-[28px]"
          role="dialog"
          aria-modal="true"
          aria-label="Dictando movimiento"
        >
          <div
            className="flex flex-1 flex-col items-center justify-center px-8 text-center"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            {fase === 'error' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <AlertTriangle className="h-8 w-8 text-white/90" strokeWidth={2} aria-hidden="true" />
                <p className="text-[19px] font-semibold leading-snug text-white">
                  {error ?? 'Algo no salió bien.'}
                </p>
              </motion.div>
            ) : palabras.length > 0 ? (
              <p className="text-[26px] font-bold leading-tight text-white sm:text-[30px]">
                {palabras.map((palabra, i) => (
                  <motion.span
                    key={`${i}-${palabra}`}
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.32, delay: i * stagger, ease: 'easeOut' }}
                    className="inline-block"
                  >
                    {palabra}
                    {i < palabras.length - 1 ? ' ' : ''}
                  </motion.span>
                ))}
                {/* El cursor que dice "sigo escuchando": solo tiene sentido
 mientras el parcial todavía puede seguir creciendo. En "revelando"
 ya no hay más que decir, y un punto latiendo ahí se vería raro. */}
                {fase === 'escuchando' ? (
                  <motion.span
                    className="ml-1 inline-block h-3 w-3 rounded-full bg-white/70 align-middle"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden="true"
                  />
                ) : null}
              </p>
            ) : (
              <>
                <motion.p
                  key={fase}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.75 }}
                  transition={{ duration: 0.3 }}
                  className="text-[22px] font-semibold leading-snug text-white sm:text-[26px]"
                >
                  {fase === 'procesando' ? COPY.input.transcribiendo : COPY.input.dictadoPrompt}
                </motion.p>

                {/* El pulso que reacciona a la voz: nada mientras procesa (ya no
 hay audio que medir), pero mientras escucha crece y se apaga con
 cada sílaba en vez de quedarse quieto. */}
                <div className="mt-10 flex h-16 items-center justify-center gap-2" aria-hidden="true">
                  {fase === 'procesando' ? (
                    [0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-3 w-3 rounded-full bg-white/80"
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                      />
                    ))
                  ) : (
                    [0, 1, 2, 3, 4].map((i) => {
                      const base = [0.35, 0.6, 1, 0.6, 0.35][i];
                      return (
                        <motion.span
                          key={i}
                          className="w-2 rounded-full bg-white"
                          animate={{ height: 14 + base * nivelAudio * 46 + base * 10 }}
                          transition={{ duration: 0.09, ease: 'easeOut' }}
                        />
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          <div
            className="flex items-center justify-between px-8 pb-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
          >
            <motion.button
              type="button"
              onClick={onCancelar}
              aria-label="Cancelar dictado"
              whileTap={{ scale: 0.9 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm"
            >
              <X className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
            </motion.button>

            <AnimatePresence mode="wait">
              {fase === 'escuchando' ? (
                <motion.button
                  key="confirmar"
                  type="button"
                  onClick={onConfirmar}
                  aria-label="Ya terminé, transcribir"
                  initial={{ opacity: 0, scale: 0.7, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.7, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_10px_28px_-8px_rgb(0_0_0/0.35)]"
                  style={{ backgroundColor: 'var(--fin-out)' }}
                >
                  <Check className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
                </motion.button>
              ) : (
                <span className="h-16 w-16" aria-hidden="true" />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
