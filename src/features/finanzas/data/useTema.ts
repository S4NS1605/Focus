import { useCallback, useEffect, useState } from 'react';

export type Tema = 'sistema' | 'claro' | 'oscuro';

// No icon here on purpose: this module is plain state and must stay free of
// React, so the glyph for each option is chosen in TemaToggle instead.
export const TEMAS: ReadonlyArray<{ id: Tema; label: string }> = [
  { id: 'claro', label: 'Claro' },
  { id: 'oscuro', label: 'Oscuro' },
  { id: 'sistema', label: 'Sistema' },
];

const CLAVE = 'finanzas:tema';

const esTema = (valor: unknown): valor is Tema =>
  valor === 'sistema' || valor === 'claro' || valor === 'oscuro';

const leerGuardado = (): Tema => {
  if (typeof window === 'undefined') return 'sistema';
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (esTema(guardado)) return guardado;
  } catch {
    // Safari in private mode throws rather than returning null.
  }
  return 'sistema';
};

/**
 * Explicit theme choice, or the system's when none was made.
 *
 * `sistema` deliberately REMOVES the attribute instead of writing a resolved
 * value. The CSS already answers `prefers-color-scheme` on its own, so leaving
 * it absent means the page follows the OS live — including a switch that happens
 * while the tab is open, which a resolved value would freeze until reload.
 */
export const useTema = () => {
  const [tema, setTemaEstado] = useState<Tema>(leerGuardado);

  useEffect(() => {
    const raiz = document.documentElement;
    if (tema === 'sistema') raiz.removeAttribute('data-tema');
    else raiz.setAttribute('data-tema', tema);
  }, [tema]);

  const setTema = useCallback((siguiente: Tema) => {
    setTemaEstado(siguiente);
    try {
      localStorage.setItem(CLAVE, siguiente);
    } catch {
      // The switch still works, it just will not be remembered.
    }
  }, []);

  return { tema, setTema };
};
