import React, { useEffect, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/**
 * Reveal on scroll. Todo el movimiento de la landing pasa por aquí, así que
 * `useReducedMotion` se respeta en un solo sitio en vez de en cada sección.
 */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li' | 'header';
}> = ({ children, delay = 0, className, as = 'div' }) => {
  const quieto = useReducedMotion();
  const Etiqueta = motion[as];

  return (
    <Etiqueta
      className={className}
      initial={quieto ? false : { opacity: 0, y: 24 }}
      whileInView={quieto ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Etiqueta>
  );
};

/**
 * Cuenta de 0 al valor cuando entra en pantalla. Anima con rAF sobre un ref en
 * vez de con estado porque a 60 fps un setState por frame vuelve a renderizar
 * la sección entera.
 */
export const Contador: React.FC<{
  hasta: number;
  formato?: (n: number) => string;
  duracion?: number;
  className?: string;
}> = ({
  hasta,
  formato = (n) => Math.round(n).toLocaleString('es-CO'),
  duracion = 1600,
  className
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const enVista = useInView(ref, { once: true, amount: 0.5 });
  const quieto = useReducedMotion();

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;

    if (!enVista) {
      nodo.textContent = formato(0);
      return;
    }

    if (quieto) {
      nodo.textContent = formato(hasta);
      return;
    }

    let frame = 0;
    let inicio: number | null = null;

    const paso = (t: number) => {
      inicio ??= t;
      const avance = Math.min((t - inicio) / duracion, 1);
      // easeOutExpo: arranca rápido y frena, que es como se lee un contador.
      const suave = avance === 1 ? 1 : 1 - Math.pow(2, -10 * avance);
      nodo.textContent = formato(hasta * suave);
      if (avance < 1) frame = requestAnimationFrame(paso);
    };

    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [enVista, hasta, duracion, formato, quieto]);

  return (
    <span ref={ref} className={className}>
      {formato(0)}
    </span>
  );
};
