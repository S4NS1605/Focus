import React from 'react';

interface WavingHandProps {
  className?: string;
}

/**
 * An open hand, light skin tone, drawn from scratch rather than an emoji.
 *
 * A system emoji glyph is whatever Apple, Google or Microsoft shipped on the
 * device reading this — three different drawings of "the same" wave, and none
 * of them ours to redistribute if we wanted the iOS one specifically. This
 * renders identically everywhere instead, the same reasoning as BrandMark.
 */
export const WavingHand: React.FC<WavingHandProps> = ({ className }) => (
  <svg
    viewBox="0 0 40 40"
    className={className}
    role="img"
    aria-label="Mano saludando"
    focusable="false"
  >
    {/* Motion lines, drawn first so the hand sits on top. */}
    <g stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.75">
      <path d="M32 9 Q35.5 7.5 37.5 9.5" fill="none" />
      <path d="M33.5 14.5 Q37.5 14 39 16.5" fill="none" />
      <path d="M32.5 20 Q36.5 20.5 37.5 23.5" fill="none" />
    </g>

    <g transform="rotate(-6 20 22)">
      {/* Palm */}
      <rect x="10.5" y="17" width="16" height="18" rx="8" fill="#FFDFC0" />

      {/* Thumb */}
      <rect
        x="6"
        y="21"
        width="7.5"
        height="13.5"
        rx="3.6"
        fill="#FFDFC0"
        transform="rotate(-24 9.75 27.75)"
      />

      {/* Fingers, pinky to index, each a rounded capsule at its own height. */}
      <rect x="11.5" y="6" width="5" height="17" rx="2.5" fill="#FFDFC0" transform="rotate(-9 14 14.5)" />
      <rect x="17" y="3.5" width="5" height="19" rx="2.5" fill="#FFDFC0" transform="rotate(-2 19.5 13)" />
      <rect x="22.5" y="4.5" width="5" height="18" rx="2.5" fill="#FFDFC0" transform="rotate(5 25 13.5)" />
      <rect x="27.5" y="8" width="4.4" height="14" rx="2.2" fill="#FFDFC0" transform="rotate(12 29.7 15)" />

      {/* Creases at each finger's base -- the one detail that keeps four
          identical capsules from reading as a mitten. */}
      <g stroke="#EBB98C" strokeWidth="1.1" strokeLinecap="round" opacity="0.8">
        <path d="M14 21.5 Q16 23 17.8 21.8" fill="none" />
        <path d="M19.5 20.5 Q21.5 22.3 23.3 20.8" fill="none" />
        <path d="M24.8 20.5 Q26.5 22 28 20.3" fill="none" />
      </g>

      {/* Palm crease. */}
      <path d="M14.5 27 Q19 29.5 23.5 26.5" stroke="#EBB98C" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.7" />
    </g>
  </svg>
);
