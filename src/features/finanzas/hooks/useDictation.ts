import { useAudioCapture } from './useAudioCapture';

export type DictationStatus = 'idle' | 'listening' | 'processing' | 'blocked';

export interface UseDictation {
  /** Si tiene sentido ofrecer el botón de una sola tocada. */
  supported: boolean;
  status: DictationStatus;
  /** Texto parcial mientras escucha. Con transcripción en servidor no hay. */
  interim: string;
  /** Lo último que salió mal, para decirlo en pantalla en vez de callarlo. */
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * Dictado por voz: grabar y transcribir, siempre por el mismo camino.
 *
 * Antes esto elegía entre dos motores según el aparato: `webkitSpeechRecognition`
 * en el navegador, y grabación con transcripción en servidor solo cuando la API
 * de voz NO existía. Esa condición nunca se cumplía donde importaba. Dentro de
 * una PWA de iOS el constructor SÍ existe —solo que no pide permiso ni dispara
 * un solo evento—, así que la app se quedaba en el motor muerto y el micrófono
 * se apagaba sin haber escuchado nada. Y en un navegador de escritorio que
 * bloquea el servicio de voz de Google, el mismo camino terminaba mandando a la
 * persona a escribir a mano.
 *
 * Ahora hay UN solo motor: `navigator.mediaDevices.getUserMedia`, que es
 * estándar y se comporta igual en todas partes. Un camino que funciona en todos
 * lados vale más que dos que hay que adivinar cuál está vivo.
 */
export const useDictation = (onFinal: (text: string) => void): UseDictation => {
  const captura = useAudioCapture(onFinal);

  return {
    supported: captura.supported,
    status: captura.status,
    interim: captura.interim,
    error: captura.error,
    start: captura.start,
    stop: captura.stop,
  };
};
