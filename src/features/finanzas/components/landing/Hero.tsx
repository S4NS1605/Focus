import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Banknote,
  Car,
  Mic,
  ShoppingBasket,
  UtensilsCrossed,
  type LucideIcon
} from 'lucide-react';
import { formatCop } from '../../lib/formatCop';
import { Contador } from './primitivas';
import { useEnPantalla, useTecleo } from './ganchos';

/* Cifras en pesos y de cuantía creíble para Colombia: un almuerzo de $28.500 y
   un pago de cliente de $2.5M cuentan la historia de un independiente, que es a
   quien va dirigida la app. */
const MOVIMIENTOS: {
  Icono: LucideIcon;
  desc: string;
  monto: number;
  tipo: 'out' | 'in';
}[] = [
  { Icono: UtensilsCrossed, desc: 'Almuerzo en La Bodega', monto: -28500, tipo: 'out' },
  { Icono: Car, desc: 'Uber a casa', monto: -15300, tipo: 'out' },
  { Icono: ShoppingBasket, desc: 'Mercado del mes', monto: -184200, tipo: 'out' },
  { Icono: Banknote, desc: 'Pago de cliente', monto: 2500000, tipo: 'in' }
];

const SALDO = 5340000;
const DICTADO = 'gasté 45 mil en almuerzo';

interface HeroProps {
  onGetStarted?: () => void;
  onSeeDemo?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onGetStarted, onSeeDemo }) => {
  const quieto = useReducedMotion();
  const { ref, enVista } = useEnPantalla<HTMLDivElement>(0.3);

  /* La secuencia del teléfono: primero entran los movimientos uno a uno, y solo
     cuando terminan arranca el dictado. Si empiezan a la vez, la pantalla se
     mueve toda de golpe y no se lee nada. */
  const [dictando, setDictando] = useState(false);
  useEffect(() => {
    if (!enVista) return;
    if (quieto) {
      setDictando(true);
      return;
    }
    const id = setTimeout(() => setDictando(true), 400 + MOVIMIENTOS.length * 220);
    return () => clearTimeout(id);
  }, [enVista, quieto]);

  const { visible, listo } = useTecleo(DICTADO, dictando);

  return (
    <section className="hero">
      <div className="hero-text">
        <h1>
          <motion.span
            initial={quieto ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            Sabe exactamente dónde
          </motion.span>
          <motion.span
            initial={quieto ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          >
            está <em>tu plata</em>.
          </motion.span>
        </h1>

        <motion.p
          className="hero-sub"
          initial={quieto ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.24 }}
        >
          Registra gastos hablando. Importa los extractos de tu banco. Entiende
          en qué se te va el mes sin que nadie te juzgue.
        </motion.p>

        <motion.div
          className="hero-ctas"
          initial={quieto ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.34 }}
        >
          <button className="btn-primary" onClick={onGetStarted}>
            Empezar gratis
            <ArrowRight size={17} strokeWidth={2} aria-hidden />
          </button>
          <button className="btn-secondary" onClick={onSeeDemo}>
            Ver demo
          </button>
        </motion.div>

        <motion.p
          className="hero-note"
          initial={quieto ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.46 }}
        >
          30 días gratis. No pide tarjeta de crédito.
        </motion.p>
      </div>

      <div className="hero-visual" ref={ref} aria-hidden="true">
        <motion.div
          className="telefono"
          initial={quieto ? false : { opacity: 0, y: 40, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="telefono-pantalla">
            <div className="balance-section">
              <span className="label">Tu saldo hoy</span>
              <span className="amount">
                <Contador hasta={SALDO} formato={(n) => formatCop(Math.round(n))} />
              </span>
            </div>

            <div className="transactions">
              {MOVIMIENTOS.map(({ Icono, desc, monto, tipo }, i) => (
                <motion.div
                  className={`tx ${tipo}`}
                  key={desc}
                  initial={quieto ? false : { opacity: 0, x: 24 }}
                  animate={enVista ? { opacity: 1, x: 0 } : undefined}
                  transition={{ duration: 0.45, delay: 0.4 + i * 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="tx-icono">
                    <Icono size={15} strokeWidth={1.75} />
                  </span>
                  <span className="desc">{desc}</span>
                  <span className="amount">
                    {monto < 0 ? '−' : '+'}
                    {formatCop(Math.abs(monto))}
                  </span>
                </motion.div>
              ))}
            </div>

            <div className={`dictado ${listo ? 'listo' : ''}`}>
              <span className="dictado-boton">
                <Mic size={16} strokeWidth={1.75} />
                {!quieto && dictando && !listo && <span className="dictado-pulso" />}
              </span>
              <span className="dictado-texto">
                {visible}
                {dictando && !listo && <span className="dictado-cursor" />}
              </span>
            </div>

            {/* El chip que aparece cuando el dictado termina: es el remate de la
                secuencia, la prueba de que la frase se volvió un gasto. */}
            <motion.div
              className="dictado-salida"
              initial={false}
              animate={
                listo && !quieto
                  ? { opacity: 1, y: 0, scale: 1 }
                  : listo
                    ? { opacity: 1 }
                    : { opacity: 0, y: 8, scale: 0.94 }
              }
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="dictado-salida-cat">
                <UtensilsCrossed size={13} strokeWidth={2} />
                Comida
              </span>
              <span className="dictado-salida-monto">−{formatCop(45000)}</span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
