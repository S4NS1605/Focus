import { useCallback, useEffect, useRef, useState } from 'react';

export type AudioCaptureStatus = 'idle' | 'recording' | 'processing' | 'blocked';

export interface UseAudioCapture {
  supported: boolean;
  status: AudioCaptureStatus;
  interim: string;
  start: () => void;
  stop: () => void;
}

/**
 * Captura audio en PWA y envía a servidor para transcribir con Whisper.
 * Reemplaza Web Speech API que no funciona en apps instaladas de iOS.
 */
export const useAudioCapture = (onFinal: (text: string) => void): UseAudioCapture => {
  const [status, setStatus] = useState<AudioCaptureStatus>('idle');
  const [interim, setInterim] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const onFinalRef = useRef(onFinal);

  // Keep callback fresh without recreating recorder
  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const supported =
    typeof navigator !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia !== undefined;

  const stop = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setInterim('');
  }, []);

  const start = useCallback(async () => {
    if (!supported || mediaRecorderRef.current) return;

    try {
      setStatus('recording');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setStatus('processing');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;

        try {
          const formData = new FormData();
          formData.append('audio', blob, 'audio.webm');

          const res = await fetch('/api/transcribir', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            console.error(`Transcription error: ${res.status}`);
            setStatus('idle');
            return;
          }

          const { text } = await res.json();
          if (text?.trim()) {
            onFinalRef.current(text.trim());
          }
        } catch (err) {
          console.error('Transcription error:', err);
        } finally {
          setStatus('idle');
        }
      };

      recorder.onerror = () => {
        setStatus('blocked');
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err: unknown) {
      if (
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      ) {
        setStatus('blocked');
      } else {
        setStatus('idle');
      }
      mediaRecorderRef.current = null;
    }
  }, [supported]);

  return { supported, status, interim, start, stop };
};
