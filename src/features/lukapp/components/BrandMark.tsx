import React from 'react';

interface BrandMarkProps {
  className?: string;
}

/**
 * The app's own mark: three ascending bars in the category palette.
 *
 * Deliberately not an emoji. It is the same geometry as the installed
 * home-screen icon (see scripts/generate-finance-icons.mjs), so the header and
 * the icon on the phone read as one brand instead of two unrelated glyphs — and
 * unlike an emoji it renders identically on every platform.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Finanzas" focusable="false">
    <rect x="3" y="14" width="4.6" height="7" rx="1.6" fill="#f59e0b" />
    <rect x="9.7" y="9" width="4.6" height="12" rx="1.6" fill="#38bdf8" />
    <rect x="16.4" y="3" width="4.6" height="18" rx="1.6" fill="#16c55e" />
  </svg>
);
