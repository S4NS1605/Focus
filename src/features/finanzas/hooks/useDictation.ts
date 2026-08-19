import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioCapture } from './useAudioCapture';

// Minimal structural types. The webkit-prefixed constructor is not in the DOM lib,
// and we only ever touch these few members.
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  0: RecognitionAlternative;
  isFinal: boolean;
}
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
interface RecognitionErrorEvent {
  error: string;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;

/**
 * How long to wait for ANY sign of life before concluding the API is present but
 * dead. Inside an installed iOS app `webkitSpeechRecognition` exists and
 * `start()` resolves, but no permission prompt appears and no event ever fires —
 * feature detection cannot distinguish that from working, so we time it out.
 */
const SILENCE_PROBE_MS = 3500;

/** Errors that mean "this will never work here", not "try again". */
const FATAL_ERRORS = new Set(['service-not-allowed', 'not-allowed', 'audio-capture']);

const getCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** True when running as an installed home-screen app. */
export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const legacy = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return legacy === true || window.matchMedia('(display-mode: standalone)').matches;
};

export type DictationStatus = 'idle' | 'listening' | 'blocked';

export interface UseDictation {
  /** Whether to offer the one-tap mic button at all. */
  supported: boolean;
  standalone: boolean;
  status: DictationStatus;
  /** Live partial transcript while listening. */
  interim: string;
  start: () => void;
  stop: () => void;
}

/**
 * One-tap dictation via the Web Speech API, offered ONLY where it actually works.
 *
 * It is deliberately not the primary input. In an installed iOS app it fails
 * silently, and the documented escape hatch (open in Safari) is circular: links
 * from a standalone app open an in-app web view, where Web Speech is also
 * disabled. The reliable path everywhere is a plain textarea plus the iOS
 * keyboard's own microphone key — that is on-device, works offline, and needs no
 * permissions from us. This hook is progressive enhancement on top of that.
 */
export const useDictation = (onFinal: (text: string) => void): UseDictation => {
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [interim, setInterim] = useState('');
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  const standalone = isStandalone();
  const hasApi = getCtor() !== null;

  // En una PWA instalada, Web Speech está presente pero rota (ver comentario
  // arriba de SILENCE_PROBE_MS): el constructor existe, así que `hasApi` no
  // sirve para distinguir este caso. Toda app standalone usa audio capture.
  const useAudioCaptureMode = standalone;
  const audioCapture = useAudioCapture(useAudioCaptureMode ? onFinal : () => {});

  const recognitionRef = useRef<Recognition | null>(null);
  const probeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sawLifeRef = useRef(false);
  const onFinalRef = useRef(onFinal);

  // Keeps the callback fresh without re-creating the recognition object, which
  // is itself a source of repeat permission prompts on WebKit.
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  // Si es PWA y Web Speech no está disponible, usar captura de audio
  if (useAudioCaptureMode) {
    return {
      supported: audioCapture.supported,
      standalone: true,
      status: audioCapture.status as DictationStatus,
      interim: audioCapture.interim,
      start: audioCapture.start,
      stop: audioCapture.stop,
    };
  }

  // Safari's implementation is server-side, so it needs the network. The keyboard
  // mic key does not, which is another reason it is the primary path.
  const supported = hasApi && !standalone && online && status !== 'blocked';

  const clearProbe = useCallback(() => {
    if (probeRef.current !== null) {
      clearTimeout(probeRef.current);
      probeRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearProbe();
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onaudiostart = null;
      recognition.onspeechstart = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped; nothing to unwind.
      }
      recognitionRef.current = null;
    }
    setInterim('');
    setStatus((prev) => (prev === 'blocked' ? 'blocked' : 'idle'));
  }, [clearProbe]);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = 'es-CO';
    // `continuous` is unreliable on WebKit — it throttles and flips isFinal
    // unexpectedly — so take one utterance at a time.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    sawLifeRef.current = false;

    const markAlive = () => {
      sawLifeRef.current = true;
      clearProbe();
    };

    recognition.onaudiostart = markAlive;
    recognition.onspeechstart = markAlive;

    recognition.onresult = (event) => {
      markAlive();
      let finalText = '';
      let partial = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else partial += result[0].transcript;
      }
      if (partial) setInterim(partial);
      if (finalText.trim()) {
        setInterim('');
        onFinalRef.current(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      clearProbe();
      if (FATAL_ERRORS.has(event.error)) {
        setStatus('blocked');
        recognitionRef.current = null;
        return;
      }
      setStatus('idle');
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      clearProbe();
      recognitionRef.current = null;
      setInterim('');
      setStatus((prev) => (prev === 'blocked' ? 'blocked' : 'idle'));
    };

    try {
      recognition.start();
    } catch {
      setStatus('blocked');
      return;
    }

    recognitionRef.current = recognition;
    setStatus('listening');

    probeRef.current = setTimeout(() => {
      if (!sawLifeRef.current) {
        // Present but dead. Fall back to the keyboard mic hint for good.
        setStatus('blocked');
        const dead = recognitionRef.current;
        recognitionRef.current = null;
        try {
          dead?.abort();
        } catch {
          // Nothing to unwind.
        }
      }
    }, SILENCE_PROBE_MS);
  }, [clearProbe]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => stop, [stop]);

  return { supported, standalone, status, interim, start, stop };
};
