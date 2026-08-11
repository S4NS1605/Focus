import { useCallback, useEffect, useState } from 'react';

/**
 * Display preferences, kept beside the theme rather than in the ledger.
 *
 * These live in localStorage, per device, for the same reason `useTema` does:
 * they say how this screen should look, not what is true about the money. A
 * phone left on the kitchen table and a laptop at work can reasonably want
 * different answers, and nothing here needs to survive a reinstall.
 */
const CLAVE_AHORRO = 'finanzas:resumen:ahorro';

const leerBooleano = (clave: string, porDefecto: boolean): boolean => {
  if (typeof window === 'undefined') return porDefecto;
  try {
    const guardado = localStorage.getItem(clave);
    if (guardado === 'si') return true;
    if (guardado === 'no') return false;
  } catch {
    // Safari in private mode throws rather than returning null.
  }
  return porDefecto;
};

const guardarBooleano = (clave: string, valor: boolean): void => {
  try {
    localStorage.setItem(clave, valor ? 'si' : 'no');
  } catch {
    // The switch still works, it just will not be remembered.
  }
};

/**
 * Whether savings count toward the summary.
 *
 * On by default: the summary is meant to answer "how much do I have", and
 * leaving savings out of that by default would understate it for everyone who
 * never finds this switch.
 */
export const useMostrarAhorro = () => {
  const [mostrarAhorro, setEstado] = useState(() => leerBooleano(CLAVE_AHORRO, true));

  const setMostrarAhorro = useCallback((valor: boolean) => {
    setEstado(valor);
    guardarBooleano(CLAVE_AHORRO, valor);
  }, []);

  // `storage` fires in the OTHER tabs, never the one that wrote. Without it two
  // open tabs drift apart and disagree about the same total until one reloads —
  // and one of them is showing a figure nobody chose.
  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      if (e.key !== null && e.key !== CLAVE_AHORRO) return;
      setEstado(leerBooleano(CLAVE_AHORRO, true));
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  return { mostrarAhorro, setMostrarAhorro };
};
