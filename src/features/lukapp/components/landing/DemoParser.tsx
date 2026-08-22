import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, Calendar, CreditCard, MessageCircle, User } from 'lucide-react';
import { parseTransaction } from '../../lib/parseTransaction';
import { CATALOGO_BASE } from '../../categorias';
import { formatCop } from '../../lib/formatCop';
import { Reveal } from './primitivas';
import { TituloPalabras } from './adornos';

const EJEMPLOS = [
  'gasté 45k en pizza',
  'uber a casa 12k ayer',
  'mercado en el éxito 180 mil',
  'le presté 50 lucas a Andrés',
  'me pagaron 2 millones',
  'netflix 38900'
];

const NOMBRE_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta_credito: 'Tarjeta de crédito',
  tarjeta_debito: 'Tarjeta débito',
  transferencia: 'Transferencia'
};

/** "2026-08-19" -> "19 de agosto", que es como se lee una fecha en la app. */
const diaLegible = (iso: string): string => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long'
  });
};

export const DemoParser: React.FC = () => {
  const [texto, setTexto] = useState(EJEMPLOS[0]);
  const quieto = useReducedMotion();

  /* El mismo parseTransaction que corre dentro de la app. La landing no simula
     el resultado: lo calcula, así que lo que el visitante ve aquí es
     exactamente lo que va a pasar cuando escriba eso mismo adentro. */
  const leido = useMemo(() => parseTransaction(texto), [texto]);
  const categoria = CATALOGO_BASE.de(leido.category);
  const { Icono } = categoria;

  const insignias = [
    leido.dateOverride && {
      clave: 'fecha',
      Icono: Calendar,
      texto: diaLegible(leido.dateOverride)
    },
    leido.signals.paymentMethod !== 'desconocido' && {
      clave: 'pago',
      Icono: CreditCard,
      texto: NOMBRE_PAGO[leido.signals.paymentMethod] ?? leido.signals.paymentMethod
    },
    leido.signals.destinatario && {
      clave: 'quien',
      Icono: User,
      texto: leido.signals.destinatario
    }
  ].filter(Boolean) as { clave: string; Icono: typeof Calendar; texto: string }[];

  return (
    <section className="demo-parser" id="demo">
      <Reveal as="header" className="seccion-cabecera">
        <span className="seccion-etiqueta">Pruébalo aquí mismo</span>
        <TituloPalabras texto="Escribe como hablas" resaltarUltimas={1} />
        <p className="seccion-sub">
          Esto no es un video. Es el mismo motor que corre dentro de LukApp.
          Cambia la frase y mira cómo la entiende.
        </p>
      </Reveal>

      <Reveal className="demo-caja" delay={0.1}>
        <label className="demo-campo">
          <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="gasté 30 mil en almuerzo"
            aria-label="Escribe un gasto en lenguaje natural"
            spellCheck={false}
          />
        </label>

        <div className="demo-ejemplos">
          {EJEMPLOS.map((frase) => (
            <button
              key={frase}
              type="button"
              className={`demo-chip ${frase === texto ? 'activo' : ''}`}
              onClick={() => setTexto(frase)}
            >
              {frase}
            </button>
          ))}
        </div>

        <ArrowDown className="demo-flecha" size={20} strokeWidth={1.75} aria-hidden />

        <div className="demo-resultado" aria-live="polite">
          {leido.amount === null ? (
            <p className="demo-vacio">Escribe un monto — «30 mil», «45k», «50 lucas»…</p>
          ) : (
            <>
              <div className="demo-fila">
                <span
                  className="demo-icono"
                  style={{ background: `${categoria.color}1f`, color: categoria.color }}
                >
                  <Icono size={22} strokeWidth={1.75} aria-hidden />
                </span>

                {/* Descripción, categoría y monto se pintan sin transición de
                    salida a propósito. Con una, el nodo viejo sigue montado
                    mientras el nuevo entra, y durante ese rato la tarjeta
                    enseña el monto de la frase anterior junto a la categoría de
                    la nueva — se lee como un error de cálculo. */}
                <div className="demo-texto">
                  <span className="demo-desc">{leido.description || 'Movimiento'}</span>
                  <span className="demo-categoria">{categoria.nombre}</span>
                </div>

                <span className={`demo-monto ${leido.kind}`}>
                  {leido.kind === 'ingreso' ? '+' : '−'}
                  {formatCop(leido.amount)}
                </span>
              </div>

              {insignias.length > 0 && (
                <div className="demo-insignias">
                  <AnimatePresence initial={false}>
                    {insignias.map(({ clave, Icono: Ins, texto: t }) => (
                      <motion.span
                        key={clave}
                        className="demo-insignia"
                        initial={quieto ? false : { opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={quieto ? undefined : { opacity: 0, scale: 0.85 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Ins size={13} strokeWidth={2} aria-hidden />
                        {t}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              <div className="demo-confianza">
                <div className="demo-barra">
                  <motion.span
                    className="demo-barra-lleno"
                    animate={{ width: `${Math.round(leido.confidence * 100)}%` }}
                    transition={{ duration: quieto ? 0 : 0.4, ease: 'easeOut' }}
                  />
                </div>
                <span className="demo-confianza-texto">
                  {Math.round(leido.confidence * 100)}% de confianza
                </span>
              </div>
            </>
          )}
        </div>
      </Reveal>
    </section>
  );
};
