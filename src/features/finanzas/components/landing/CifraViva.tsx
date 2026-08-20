import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Un número que rueda de su valor anterior al nuevo cada vez que cambia.
 *
 * Distinto de `Contador`, que solo sabe ir de cero al valor una vez cuando
 * entra en pantalla. Aquí el saldo sube y baja durante todo el ciclo del
 * teléfono, así que hay que interpolar entre dos valores cualesquiera.
 *
 * Escribe en el nodo con un ref en vez de con estado: a 60 fps, un setState por
 * frame volvería a renderizar la pantalla entera del mockup —lista de
 * movimientos incluida— sesenta veces por segundo.
 */
export const CifraViva: React.FC<{
  valor: number;
  formato: (n: number) => string;
  duracion?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ valor, formato, duracion = 900, className, style }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const desde = useRef(valor);
  const quieto = useReducedMotion();

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;

    const inicio = desde.current;
    const delta = valor - inicio;
    desde.current = valor;

    if (quieto || delta === 0) {
      nodo.textContent = formato(valor);
      return;
    }

    let frame = 0;
    let t0: number | null = null;

    const paso = (t: number) => {
      t0 ??= t;
      const avance = Math.min((t - t0) / duracion, 1);
      // easeOutExpo: arranca rápido y frena, que es como se lee un contador.
      const suave = avance === 1 ? 1 : 1 - Math.pow(2, -10 * avance);
      nodo.textContent = formato(inicio + delta * suave);
      if (avance < 1) frame = requestAnimationFrame(paso);
    };

    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valor, formato, duracion, quieto]);

  return (
    <span ref={ref} className={className} style={style}>
      {formato(valor)}
    </span>
  );
};
