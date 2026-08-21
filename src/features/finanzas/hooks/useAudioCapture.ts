import { useCallback, useEffect, useRef, useState } from 'react';
import { usePermisoDeMicrófono } from './usePermisoDeMicrófono';

export type AudioCaptureStatus = 'idle' | 'listening' | 'processing' | 'blocked';

export interface UseAudioCapture {
  supported: boolean;
  status: AudioCaptureStatus;
  interim: string;
  /**
   * Qué tan fuerte está hablando ahora mismo, de 0 a 1. Puramente decorativo
   * (el medidor de nivel del micrófono en la pantalla de dictado); si el
   * navegador no da Web Audio, se queda en 0 y todo lo demás sigue igual.
   */
  level: number;
  /** Lo último que salió mal, en palabras que se puedan enseñar en pantalla. */
  error: string | null;
  start: () => void;
  stop: () => void;
  /** Corta la grabación y la descarta: nunca se sube a transcribir. */
  cancel: () => void;
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
 * Cada cuánto se manda a transcribir el audio acumulado HASTA AHORA, mientras
 * se sigue grabando -- esto es todo el "streaming": no hay conexión en vivo a
 * ningún motor, es Groq (rapidísimo) contestando cada vez con un trozo más
 * largo. `MediaRecorder` entrega los trozos en orden y cada uno depende del
 * anterior (el encabezado del contenedor solo va en el primero), así que lo
 * que se manda cada vez es la concatenación completa de todos los trozos
 * hasta ese punto -- un archivo válido y cada vez más largo, no un pedazo
 * suelto que Whisper no sabría decodificar.
 */
const INTERVALO_PARCIAL_MS = 1600;

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
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const permiso = usePermisoDeMicrófono();

  const grabadoraRef = useRef<MediaRecorder | null>(null);
  const trozosRef = useRef<Blob[]>([]);
  const topeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicioRef = useRef(0);
  const onFinalRef = useRef(onFinal);
  // Si se cancela mientras se graba (o mientras el permiso todavía se está
  // pidiendo), el audio que ya se capturó se tira en vez de subirse.
  const canceladoRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analiserRef = useRef<AnalyserNode | null>(null);
  const medidorRafRef = useRef<number | null>(null);
  // Identifica cada grabación: si una respuesta parcial llega tarde, después
  // de que ya empezó otra grabación, se descarta en vez de pisar el texto
  // de la sesión nueva.
  const sesionRef = useRef(0);
  // Nunca dos parciales en vuelo a la vez -- el siguiente trozo simplemente
  // espera al que ya salió en vez de amontonar peticiones.
  const parcialEnVueloRef = useRef(false);

  const detenerMedidor = useCallback(() => {
    if (medidorRafRef.current !== null) {
      cancelAnimationFrame(medidorRafRef.current);
      medidorRafRef.current = null;
    }
    analiserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setLevel(0);
  }, []);

  /**
   * El pulso que reacciona a la voz en la pantalla de dictado. Es puramente
   * decorativo: si `AudioContext` no existe o falla, la grabación sigue
   * exactamente igual, solo sin el medidor.
   */
  const iniciarMedidor = useCallback((stream: MediaStream) => {
    try {
      const AudioCtxCtor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxCtor) return;
      const ctx = new AudioCtxCtor();
      const fuente = ctx.createMediaStreamSource(stream);
      const analiser = ctx.createAnalyser();
      analiser.fftSize = 256;
      analiser.smoothingTimeConstant = 0.6;
      fuente.connect(analiser);
      audioCtxRef.current = ctx;
      analiserRef.current = analiser;

      const datos = new Uint8Array(analiser.frequencyBinCount);
      const tick = () => {
        if (!analiserRef.current) return;
        analiserRef.current.getByteFrequencyData(datos);
        let suma = 0;
        for (let i = 0; i < datos.length; i += 1) suma += datos[i];
        const promedio = suma / datos.length;
        setLevel(Math.min(1, promedio / 90));
        medidorRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Sin medidor, pero la grabación sigue.
    }
  }, []);

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
    // El último parcial se queda en pantalla mientras se confirma la versión
    // definitiva -- borrar aquí hacía que el texto desapareciera y volviera a
    // aparecer un instante después, como si se hubiera perdido lo dicho.
  }, [quitarTope]);

  const cancel = useCallback(() => {
    canceladoRef.current = true;
    quitarTope();
    detenerMedidor();
    const grabadora = grabadoraRef.current;
    if (grabadora && grabadora.state !== 'inactive') {
      // `onstop` ve el flag y descarta el audio en vez de subirlo.
      grabadora.stop();
    } else {
      // Todavía no hay grabadora (esperando el permiso). `start` revisa el
      // flag apenas el permiso llega y bota el micrófono sin grabar nada.
      setStatus('idle');
    }
    setInterim('');
  }, [quitarTope, detenerMedidor]);

  const start = useCallback(async () => {
    if (!supported || grabadoraRef.current) return;
    setError(null);
    setInterim('');
    canceladoRef.current = false;
    const miSesion = ++sesionRef.current;

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

    // Se pidió cancelar mientras el permiso todavía se estaba pidiendo: el
    // micrófono nunca debe quedar encendido de fondo, y no hay nada que subir.
    if (canceladoRef.current) {
      canceladoRef.current = false;
      stream.getTracks().forEach((pista) => pista.stop());
      setStatus('idle');
      return;
    }

    const cerrarMicrofono = () => {
      stream.getTracks().forEach((pista) => pista.stop());
      detenerMedidor();
    };

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

    /**
     * El "streaming": no hay conexión en vivo a ningún motor de voz, es Groq
     * (rapidísimo) contestando de nuevo cada ~1.6s con el audio acumulado
     * hasta ese momento. Cada respuesta reemplaza a la anterior -- Whisper a
     * veces se corrige a sí mismo con más contexto, y eso es justo lo que se
     * quiere mostrar, no un texto que solo crece y nunca se corrige.
     */
    const dispararParcial = () => {
      if (parcialEnVueloRef.current) return;
      if (trozosRef.current.length === 0) return;
      parcialEnVueloRef.current = true;

      const tipoParcial = grabadora.mimeType || 'audio/webm';
      const audioHastaAhora = new Blob(trozosRef.current, { type: tipoParcial });
      if (audioHastaAhora.size === 0) {
        parcialEnVueloRef.current = false;
        return;
      }

      fetch('/api/transcribir', {
        method: 'POST',
        headers: { 'Content-Type': tipoParcial },
        body: audioHastaAhora,
      })
        .then((r) => r.json().catch(() => null))
        .then((datos: { text?: string; offline?: boolean } | null) => {
          // Otra grabación ya empezó (se canceló y se volvió a tocar el
          // micrófono, por ejemplo): esta respuesta ya no es de nadie.
          if (miSesion !== sesionRef.current) return;
          if (!datos || datos.offline) return;
          const texto = typeof datos.text === 'string' ? datos.text.trim() : '';
          // Un parcial vacío no borra lo que ya se había mostrado: un
          // silencio de medio segundo entre palabras no debe hacer
          // parpadear el texto a blanco y de vuelta.
          if (texto) setInterim(texto);
        })
        .catch(() => {})
        .finally(() => {
          parcialEnVueloRef.current = false;
        });
    };

    grabadora.ondataavailable = (evento) => {
      if (evento.data.size > 0) trozosRef.current.push(evento.data);
      // El trozo final (el que suelta `stop()`) llega con el estado ya en
      // 'inactive' -- ese lo procesa `onstop`, que hace la transcripción
      // completa y definitiva. Un parcial solo tiene sentido mientras se
      // sigue grabando.
      if (grabadora.state === 'recording') dispararParcial();
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

      if (canceladoRef.current) {
        canceladoRef.current = false;
        trozosRef.current = [];
        setStatus('idle');
        return;
      }

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
    grabadora.start(INTERVALO_PARCIAL_MS);
    iniciarMedidor(stream);
    setStatus('listening');
    topeRef.current = setTimeout(stop, MAX_MS);
  }, [supported, quitarTope, stop, iniciarMedidor, detenerMedidor]);

  // Si la pantalla se va mientras graba, se cierra el micrófono igual.
  useEffect(() => stop, [stop]);

  return { supported, status, interim, level, error, start, stop, cancel };
};
