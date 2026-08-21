import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Bus,
  Film,
  Home,
  ShoppingCart,
  Utensils,
  type LucideIcon
} from 'lucide-react';
import { MockupTelefono } from './MockupTelefono';
import { Parallax } from './adornos';

interface HeroProps {
  onGetStarted?: () => void;
  onSeeDemo?: () => void;
}

/* Las burbujas que flotan detrás del teléfono. Llevan los mismos colores de
   categoría de la app, así que el fondo dice "esto clasifica tus gastos" sin
   una sola palabra. Cada una tiene su propia duración para que no laten a
   la vez, que es lo que delata una animación hecha a máquina. */
const BURBUJAS: { Icono: LucideIcon; color: string; x: string; y: string; dur: number }[] = [
  { Icono: Utensils, color: '#f59e0b', x: '4%', y: '12%', dur: 7 },
  { Icono: Bus, color: '#3b82f6', x: '86%', y: '22%', dur: 9 },
  { Icono: ShoppingCart, color: '#10b981', x: '0%', y: '62%', dur: 8 },
  { Icono: Film, color: '#8b5cf6', x: '88%', y: '72%', dur: 10 },
  { Icono: Home, color: '#ef4444', x: '10%', y: '88%', dur: 11 }
];

export const Hero: React.FC<HeroProps> = ({ onGetStarted, onSeeDemo }) => {
  const quieto = useReducedMotion();

  return (
    <section className="hero">
      <div className="hero-text">
        <h1>
          <motion.span
            initial={quieto ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            Controla tus finanzas
          </motion.span>
          <motion.span
            initial={quieto ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            sin <em>perder tiempo</em>.
          </motion.span>
        </h1>

        <motion.p
          className="hero-sub"
          initial={quieto ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24 }}
        >
          Registra movimientos hablando. Sincroniza con tu banco. Visualiza patrones
          de gasto en tiempo real.
        </motion.p>

        <motion.div
          className="hero-ctas"
          initial={quieto ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.34 }}
        >
          <button className="btn-primary" onClick={onGetStarted}>
            Comenzar ahora
            <ArrowRight size={17} strokeWidth={2} aria-hidden />
          </button>
          {/* El botón de demo lleva su propio peso en vez de ser el hueco que
              queda al lado del principal: el disco de play dice qué va a pasar
              antes de leer la etiqueta, y el anillo que sale de él al pasar por
              encima es la única señal de que esto reproduce algo. */}
          <button className="btn-demo" onClick={onSeeDemo}>
            <span className="btn-demo-disco" aria-hidden>
              <svg width="9" height="11" viewBox="0 0 9 11" fill="none">
                <path
                  d="M1.2.85 8.1 4.9a.7.7 0 0 1 0 1.2L1.2 10.15A.7.7 0 0 1 .15 9.55V1.45A.7.7 0 0 1 1.2.85Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            Ver demo
          </button>
        </motion.div>

      </div>

      <div className="hero-visual">
        {!quieto && (
          <div className="burbujas" aria-hidden>
            {BURBUJAS.map(({ Icono, color, x, y, dur }, i) => (
              <motion.span
                key={x + y}
                className="burbuja"
                style={{ left: x, top: y, background: `${color}1f`, color }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1, y: [0, -14, 0] }}
                transition={{
                  opacity: { duration: 0.5, delay: 0.7 + i * 0.12 },
                  scale: { duration: 0.5, delay: 0.7 + i * 0.12 },
                  y: { duration: dur, repeat: Infinity, ease: 'easeInOut' }
                }}
              >
                <Icono size={19} strokeWidth={2} />
              </motion.span>
            ))}
          </div>
        )}

        <Parallax distancia={-48}>
          <motion.div
            initial={quieto ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <MockupTelefono />
          </motion.div>
        </Parallax>
      </div>
    </section>
  );
};
