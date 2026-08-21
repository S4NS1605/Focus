import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';

/**
 * Teclea un texto letra por letra cuando `activo` se enciende. Devuelve también
 * si ya terminó, para encadenar lo que venga después.
 */
export const useTecleo = (
  texto: string,
  activo: boolean,
  msPorLetra = 55,
): { visible: string; listo: boolean } => {
  const quieto = useReducedMotion();
  const [largo, setLargo] = useState(0);

  useEffect(() => {
    if (!activo) {
      setLargo(0);
      return;
    }
    if (quieto) {
      setLargo(texto.length);
      return;
    }

    setLargo(0);
    const id = setInterval(() => {
      setLargo((n) => {
        if (n >= texto.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, msPorLetra);

    return () => clearInterval(id);
  }, [texto, activo, msPorLetra, quieto]);

  return { visible: texto.slice(0, largo), listo: largo >= texto.length };
};

/** Marca cuándo un nodo entró en pantalla, para arrancar secuencias. */
export const useEnPantalla = <T extends HTMLElement>(amount = 0.4) => {
  const ref = useRef<T>(null);
  const enVista = useInView(ref, { once: true, amount });
  return { ref, enVista };
};
