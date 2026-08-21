import React from 'react';
import { Reveal, Contador } from './primitivas';
import { LineaQueSeDibuja } from './adornos';
import { TOPE_EXENTO_UVT } from '../../lib/gmf';

/**
 * La banda de cifras entre el demo y las funciones.
 *
 * Todas son verificables y ninguna es de vanidad: no dice "10.000 usuarios
 * felices" porque eso no se puede comprobar y el visitante lo sabe. Dice cuántas
 * formas de anotar hay, cuántos bancos lee y cuántas UVT exentas cuenta — cosas
 * que la app o hace o no hace.
 */
const CIFRAS: { hasta: number; sufijo?: string; etiqueta: string }[] = [
  { hasta: 6, etiqueta: 'formas de anotar un gasto' },
  { hasta: 4, etiqueta: 'bancos que lee del PDF' },
  { hasta: TOPE_EXENTO_UVT, etiqueta: 'UVT exentas que te cuenta al mes' },
  { hasta: 0, sufijo: '$', etiqueta: 'que cuesta empezar' },
];

export const BandaCifras: React.FC = () => (
  <section className="banda-cifras">
    <LineaQueSeDibuja />
    <div className="banda-grid">
      {CIFRAS.map(({ hasta, sufijo, etiqueta }, i) => (
        <Reveal className="banda-item" key={etiqueta} delay={i * 0.09}>
          <span className="banda-numero">
            {sufijo}
            <Contador hasta={hasta} formato={(n) => Math.round(n).toString()} />
          </span>
          <span className="banda-etiqueta">{etiqueta}</span>
        </Reveal>
      ))}
    </div>
    <LineaQueSeDibuja />
  </section>
);
