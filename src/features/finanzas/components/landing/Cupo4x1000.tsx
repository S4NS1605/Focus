import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Landmark } from 'lucide-react';
import {
  TARIFA_GMF,
  TOPE_EXENTO_UVT,
  UVT_POR_DEFECTO,
  gmfDe,
  topeExentoCop
} from '../../lib/gmf';
import { formatCop } from '../../lib/formatCop';
import { Contador, Reveal } from './primitivas';
import { useEnPantalla } from './ganchos';

/* Las cifras salen de lib/gmf.ts, no están escritas a mano aquí: cuando la DIAN
   mueva la UVT en enero y alguien actualice esa constante, la landing se corrige
   sola en vez de quedar mintiendo. */
const TOPE = topeExentoCop(UVT_POR_DEFECTO);
const CONSUMIDO = 12_640_000;
const PCT = CONSUMIDO / TOPE;

const RADIO = 78;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

export const Cupo4x1000: React.FC = () => {
  const quieto = useReducedMotion();
  const { ref, enVista } = useEnPantalla<HTMLDivElement>(0.4);
  const restante = TOPE - CONSUMIDO;

  return (
    <section className="gmf" id="cuatro-por-mil">
      <div className="gmf-caja">
        <Reveal className="gmf-texto">
          <span className="seccion-etiqueta">
            <Landmark size={13} strokeWidth={2} aria-hidden />
            Solo para Colombia
          </span>
          <h2>
            Tu cupo del <em>4×1000</em>, contado de verdad
          </h2>
          <p>
            Ninguna app de finanzas hecha afuera sabe qué es el GMF. Lukapp lleva
            la cuenta de tus {TOPE_EXENTO_UVT} UVT exentas al mes, repartidas
            entre todas tus cuentas como manda la norma desde diciembre de 2024,
            y te dice cuánto te va a costar mover la plata antes de que la muevas.
          </p>

          <dl className="gmf-datos">
            <div>
              <dt>Tope exento del mes</dt>
              <dd>{formatCop(TOPE)}</dd>
            </div>
            <div>
              <dt>Tarifa</dt>
              <dd>{(TARIFA_GMF * 1000).toFixed(0)} por mil</dd>
            </div>
            <div>
              <dt>Un retiro de $1.000.000 fuera del cupo</dt>
              <dd className="gmf-costo">cuesta {formatCop(gmfDe(1_000_000))}</dd>
            </div>
          </dl>

          <p className="gmf-fuente">{UVT_POR_DEFECTO.fuente}</p>
        </Reveal>

        <Reveal className="gmf-visual" delay={0.12}>
          <div className="gmf-medidor" ref={ref}>
            <svg viewBox="0 0 200 200" role="img" aria-label={`Cupo consumido: ${formatCop(CONSUMIDO)} de ${formatCop(TOPE)}`}>
              <circle className="gmf-riel" cx="100" cy="100" r={RADIO} />
              <motion.circle
                className="gmf-arco"
                cx="100"
                cy="100"
                r={RADIO}
                strokeDasharray={CIRCUNFERENCIA}
                initial={quieto ? false : { strokeDashoffset: CIRCUNFERENCIA }}
                animate={enVista ? { strokeDashoffset: CIRCUNFERENCIA * (1 - PCT) } : undefined}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              />
            </svg>

            <div className="gmf-centro">
              <span className="gmf-pct">
                <Contador hasta={Math.round(PCT * 100)} formato={(n) => `${Math.round(n)}%`} />
              </span>
              <span className="gmf-centro-etq">del cupo usado</span>
            </div>
          </div>

          <div className="gmf-leyenda">
            <span className="gmf-leyenda-item usado">
              Usado <strong>{formatCop(CONSUMIDO)}</strong>
            </span>
            <span className="gmf-leyenda-item libre">
              Te queda <strong>{formatCop(restante)}</strong>
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
