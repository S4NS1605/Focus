/**
 * Sonidos interactivos para retroalimentación de audio.
 * Genera tonos con Web Audio API (sin archivos externos).
 */

export type SoundType =
  | 'click'      // Click suave (300Hz, 50ms) - botones normales
  | 'success'    // Campana de éxito (800Hz subiendo a 1200Hz) - guardar
  | 'error'      // Buzzer de error (200Hz descendiendo) - validación
  | 'warning'    // Alerta (600Hz pulsante) - advertencia
  | 'selection'; // Tono suave (400Hz, 30ms) - cambios de selección

let audioContextInstance: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContextInstance) {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    audioContextInstance = new AudioContextClass();
  }
  return audioContextInstance;
};

const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  } catch (err) {
    console.debug('Audio feedback not available:', err);
  }
};

const playSoundPattern = (pattern: Array<{ freq: number; duration: number }>) => {
  try {
    const ctx = getAudioContext();
    let time = ctx.currentTime;

    pattern.forEach(({ freq, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

      osc.start(time);
      osc.stop(time + duration);

      time += duration + 0.05; // Pequeña pausa entre tonos
    });
  } catch (err) {
    console.debug('Audio pattern not available:', err);
  }
};

const SOUND_PATTERNS: Record<SoundType, () => void> = {
  click: () => playTone(300, 0.05, 'sine'),

  selection: () => playTone(400, 0.03, 'sine'),

  success: () => {
    playSoundPattern([
      { freq: 800, duration: 0.1 },
      { freq: 1200, duration: 0.2 },
    ]);
  },

  error: () => {
    playSoundPattern([
      { freq: 300, duration: 0.1 },
      { freq: 150, duration: 0.15 },
    ]);
  },

  warning: () => {
    playSoundPattern([
      { freq: 600, duration: 0.08 },
      { freq: 600, duration: 0.08 },
      { freq: 600, duration: 0.08 },
    ]);
  },
};

/**
 * Hook para reproducir sonidos interactivos.
 * Compatible con todos los navegadores modernos.
 */
export const useAudioFeedback = () => {
  const supported =
    typeof window !== 'undefined' &&
    (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined');

  const play = (type: SoundType): void => {
    if (!supported) return;

    try {
      const soundFn = SOUND_PATTERNS[type];
      if (soundFn) {
        soundFn();
      }
    } catch (err) {
      console.debug('Sound playback error:', err);
    }
  };

  return { supported, play };
};

export default useAudioFeedback;
