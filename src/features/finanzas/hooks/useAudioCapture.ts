import { useCallback, useEffect, useRef, useState } from 'react';
import { usePermisoDeMicrófono } from './usePermisoDeMicrófono';

export type AudioCaptureStatus = 'idle' | 'listening' | 'processing' | 'blocked';

export interface UseAudioCapture {
  supported: boolean;
  status: AudioCaptureStatus;
  interim: string;
  /** Lo último que salió mal, en palabras que se puedan enseñar en pantalla. */
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * Formatos que se le piden a MediaRecorder, del mejor al que siempre queda.
 *
 * El orden importa: Safari de iPhone solo graba mp4, y Chrome solo webm. Pedir
 * un formato que el aparato no sabe grabar hace que `new MediaRecorder` lance,
 * y ese error se veía como "el micrófono se prendió y se apagó solo".
 */
const FORMATOS = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg;codecs=opus',
];

const primerFormatoSoportado = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return FORMATOS.find((formato) => MediaRecorder.isTypeSupported(formato)) ?? '';
};

/**
 * Tope duro de grabación.
 *
 * Sin esto, una grabación que nadie detiene se queda abierta para siempre con el
 * micrófono encendido, y el audio nunca se sube. Un minuto es mucho más de lo
 * que dura decir un gasto.
 */
const MAX_MS = 60_000;

/**
 * Lo mínimo que tiene que durar una grabación para molestarse en subirla.
 *
 * Prender y apagar el micrófono de una manda medio segundo de silencio, y
 * Whisper no contesta "no oí nada": se inventa una frase de relleno. Descartar
 * aquí es más honesto que adivinar después, y de paso ahorra la petición.
 */
const MIN_MS = 800;

/**
 * Lo que Whisper devuelve cuando le llega silencio.
 *
 * No es un error suyo: el modelo se entrenó con subtítulos de video, y en un
 * tramo mudo lo más probable según sus datos es la despedida del youtuber. Por
 * eso hay que reconocerlas y tirarlas, o "Gracias" acaba siendo un gasto.
 */
const ALUCINACIONES = new Set([
  'gracias',
  'gracias por ver el video',
  'gracias por ver',
  'gracias por su atencion',
  'suscribete al canal',
  'subtitulos realizados por la comunidad de amara org',
  'subtitulado por la comunidad de amara org',
  'amara org',
  'mas videos en',
  'hasta la proxima',
  'adios',
]);

/** Sin tildes, sin signos y en minúscula, para poder comparar de verdad. */
const desnudo = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const esAlucinacion = (texto: string): boolean => ALUCINACIONES.has(desnudo(texto));

/** Traduce el motivo técnico del servidor a algo que se pueda leer. */
const enPalabras = (motivo: string | undefined): string => {
  if (!motivo) return 'No se pudo transcribir. Escríbelo a mano.';
  if (motivo.includes('llave') || motivo.includes('API_KEY')) {
    return 'Falta configurar la clave de transcripción en el servidor.';
  }
  if (motivo.includes('No llegó audio')) {
    return 'No se grabó nada. Mantén la app abierta mientras hablas.';
  }
  return 'No se pudo transcribir. Escríbelo a mano.';
};

/**
 * Graba lo que la persona dice y lo manda a transcribir.
 *
 * Usa la API estándar `navigator.mediaDevices.getUserMedia`, que es la única que
 * funciona igual en el navegador y en la app instalada. La alternativa
 * (`webkitSpeechRecognition`) existe dentro de una PWA de iOS pero está muerta:
 * no pide permiso y no dispara ningún evento, así que no se puede distinguir de
 * una que funciona hasta que ya falló.
 *
 * El audio se manda como CUERPO CRUDO, no como multipart. Es el contrato que
 * `api/transcribir.ts` espera: en el borde no hay parser de formularios, así que
 * un `FormData` llegaba entero —con sobre y todo— y Whisper lo rechazaba por no
 * ser audio.
 */
export const useAudioCapture = (onFinal: (text: string) => void): UseAudioCapture => {
  const [status, setStatus] = useState<AudioCaptureStatus>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const permiso = usePermisoDeMicrófono();

  const grabadoraRef = useRef<MediaRecorder | null>(null);
  const trozosRef = useRef<Blob[]>([]);
  const topeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicioRef = useRef(0);
  const onFinalRef = useRef(onFinal);

  // Mantiene fresco el callback sin volver a crear la grabadora.
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const supported =
    typeof navigator !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia !== undefined;

  const quitarTope = useCallback(() => {
    if (topeRef.current !== null) {
      clearTimeout(topeRef.current);
      topeRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    quitarTope();
    const grabadora = grabadoraRef.current;
    if (grabadora && grabadora.state !== 'inactive') {
      // `onstop` hace el resto: cierra el micrófono y sube el audio.
      grabadora.stop();
    }
    setInterim('');
  }, [quitarTope]);

  const start = useCallback(async () => {
    if (!supported || grabadoraRef.current) return;
    setError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err: unknown) {
      const nombre = err instanceof DOMException ? err.name : '';
      if (nombre === 'NotAllowedError' || nombre === 'PermissionDeniedError') {
        setStatus('blocked');
        permiso.marcarComoPedido();
        // En iOS, el permiso se pide en un diálogo que solo aparece la primera vez.
        // Si el usuario tocó "No", tiene que ir a Ajustes manualmente.
        const mensaje = permiso.permisoPedidoAntes
          ? 'El permiso del micrófono está denegado. Ve a Ajustes › Finanzas › Micrófono.'
          : 'Necesitamos acceso al micrófono. Cuando pida permiso, toca "Sí".';
        setError(mensaje);
      } else {
        setStatus('idle');
        setError('No se pudo abrir el micrófono.');
      }
      return;
    }

    const cerrarMicrofono = () => stream.getTracks().forEach((pista) => pista.stop());

    let grabadora: MediaRecorder;
    try {
      const formato = primerFormatoSoportado();
      // Sin formato explícito, el navegador escoge el suyo — que es justo lo que
      // se quiere cuando ninguno de la lista está disponible.
      grabadora = formato ? new MediaRecorder(stream, { mimeType: formato }) : new MediaRecorder(stream);
    } catch {
      cerrarMicrofono();
      setStatus('idle');
      setError('Este teléfono no deja grabar audio desde la app.');
      return;
    }

    trozosRef.current = [];

    grabadora.ondataavailable = (evento) => {
      if (evento.data.size > 0) trozosRef.current.push(evento.data);
    };

    grabadora.onerror = () => {
      quitarTope();
      cerrarMicrofono();
      grabadoraRef.current = null;
      setStatus('idle');
      setError('Se interrumpió la grabación.');
    };

    grabadora.onstop = async () => {
      quitarTope();
      cerrarMicrofono();
      grabadoraRef.current = null;

      // `grabadora.mimeType` es el formato REAL que quedó, que no siempre es el
      // que se pidió. El servidor decide por él qué extensión mandarle a
      // Whisper, y Whisper decide el decodificador por la extensión.
      const tipo = grabadora.mimeType || 'audio/webm';
      const audio = new Blob(trozosRef.current, { type: tipo });
      trozosRef.current = [];

      const duracion = Date.now() - inicioRef.current;
      if (audio.size === 0 || duracion < MIN_MS) {
        setStatus('idle');
        setError('Muy corto. Deja el micrófono abierto mientras hablas.');
        return;
      }

      setStatus('processing');
      try {
        const respuesta = await fetch('/api/transcribir', {
          method: 'POST',
          headers: { 'Content-Type': tipo },
          body: audio,
        });

        const datos = (await respuesta.json().catch(() => null)) as
          | { text?: string; offline?: boolean; error?: string }
          | null;

        if (!respuesta.ok || !datos) {
          setError('No se pudo conectar para transcribir.');
          return;
        }

        // El servidor contesta 200 incluso cuando no pudo, para que la app
        // siga funcionando sin conexión. Mirar solo `respuesta.ok` hacía que
        // cada fallo pasara en silencio y pareciera que el micrófono no hizo
        // nada.
        if (datos.offline) {
          setError(enPalabras(datos.error));
          return;
        }

        const texto = typeof datos.text === 'string' ? datos.text.trim() : '';
        if (!texto || esAlucinacion(texto)) {
          setError('No se entendió lo que dijiste. Intenta otra vez.');
          return;
        }

        onFinalRef.current(texto);
      } catch {
        setError('No se pudo conectar para transcribir.');
      } finally {
        setStatus('idle');
      }
    };

    grabadoraRef.current = grabadora;
    inicioRef.current = Date.now();
    grabadora.start();
    setStatus('listening');
    topeRef.current = setTimeout(stop, MAX_MS);
  }, [supported, quitarTope, stop]);

  // Si la pantalla se va mientras graba, se cierra el micrófono igual.
  useEffect(() => stop, [stop]);

  return { supported, status, interim, error, start, stop };
};
