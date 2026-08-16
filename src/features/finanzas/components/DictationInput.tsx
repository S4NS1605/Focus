import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Info, Mic, Sparkles, Square } from 'lucide-react';
import { COPY } from '../copy';
import { useDictation } from '../hooks/useDictation';
import { useImageOCR } from '../hooks/useImageOCR';
import { useRef } from 'react';

interface DictationInputProps {
  onSubmit: (text: string) => void;
}

export const DictationInput: React.FC<DictationInputProps> = ({ onSubmit }) => {
  const [text, setText] = useState('');

  const dictation = useDictation((finalText) => {
    setText(finalText);
    onSubmit(finalText);
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { scanImage, isScanning, progress, error } = useImageOCR((scannedText) => {
    setText(scannedText);
    onSubmit(scannedText);
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) scanImage(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  };

  const listening = dictation.status === 'listening';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* The textarea is the PRIMARY voice path: tapping it brings up the iOS
          keyboard, whose microphone key is on-device dictation. That works in the
          installed app and offline, which the Web Speech API does not. */}
      <textarea
        value={listening && dictation.interim ? dictation.interim : text}
        onChange={(e) => setText(e.target.value)}
        placeholder={COPY.input.placeholder}
        rows={2}
        // 16px minimum: anything smaller makes iOS auto-zoom on focus and never
        // zoom back out.
        className="w-full resize-none rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-base text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-faint)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
        aria-label={COPY.input.placeholder}
      />

      <div className="flex items-center gap-3">
        <motion.button
          type="submit"
          disabled={!text.trim()}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--fin-accent)] px-6 py-3.5 text-sm font-bold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)] disabled:opacity-30"
        >
          <Sparkles className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          {COPY.input.submit}
        </motion.button>

        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />

        <motion.button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          disabled={isScanning}
          aria-label="Subir comprobante"
          className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--fin-out-bg)] text-[var(--fin-out)] transition-colors hover:bg-[var(--fin-card-hover)] disabled:opacity-50"
        >
          <Camera className="h-6 w-6" strokeWidth={2.5} />
        </motion.button>

        {/* One-tap dictation, shown only where it genuinely works. */}
        {dictation.supported ? (
          <motion.button
            type="button"
            onClick={listening ? dictation.stop : dictation.start}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-pressed={listening}
            aria-label={listening ? COPY.input.stop : COPY.input.speak}
            className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors ${
              listening
                ? 'bg-[var(--fin-out-bg)] text-[var(--fin-out)]'
                : 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)] hover:bg-[var(--fin-accent-hover)]'
            }`}
          >
            {listening ? <Square className="h-5 w-5" strokeWidth={3} /> : <Mic className="h-6 w-6" strokeWidth={2.5} />}
          </motion.button>
        ) : null}
      </div>

      {/* Status line. aria-live so the parse outcome is announced, not just shown. */}
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]" aria-live="polite">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
        <span>
          {isScanning
            ? `Analizando comprobante... (${Math.round(progress * 100)}%)`
            : error
              ? error
              : listening
                ? COPY.input.listening
                : dictation.status === 'blocked'
                  ? COPY.input.blocked
                  : dictation.standalone
                    ? COPY.input.keyboardHint
                    : dictation.supported
                      ? COPY.input.keyboardHint
                      : COPY.input.offline}
        </span>
      </p>
    </form>
  );
};
