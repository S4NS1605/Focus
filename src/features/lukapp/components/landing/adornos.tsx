import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';

/**
 * La barra de progreso de la nav. Es la única pieza que le dice al visitante
 * cuánto le queda de página, y en una landing larga eso es la diferencia entre
 * seguir bajando y pensar que esto no se acaba.
 */
export const BarraProgreso: React.FC = () => {
  const { scrollYProgress } = useScroll();
  // El muelle evita que la barra tiemble con el scroll de rueda, que llega a
  // saltos y no continuo.
  const ancho = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  return <motion.span className="barra-progreso" style={{ scaleX: ancho }} aria-hidden />;
};

/**
 * Un titular que se arma palabra por palabra al entrar en pantalla.
 *
 * Cada palabra es su propio span con `overflow: hidden` en el contenedor, así
 * que la palabra sube desde debajo de su propia línea en vez de aparecer sin
 * más. Es el mismo truco de las portadas editoriales.
 */
export const TituloPalabras: React.FC<{
  texto: string;
  className?: string;
  /** La última palabra en color de marca, como el "tu plata" del hero. */
  resaltarUltimas?: number;
}> = ({ texto, className, resaltarUltimas = 0 }) => {
  const quieto = useReducedMotion();
  const palabras = texto.split(' ');
  const desde = palabras.length - resaltarUltimas;

  if (quieto) return <h2 className={className}>{texto}</h2>;

  return (
    <h2 className={className}>
      {palabras.map((palabra, i) => (
        <span className="palabra" key={`${palabra}-${i}`}>
          <motion.span
            initial={{ y: '110%' }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.65, delay: i * 0.055, ease: [0.16, 1, 0.3, 1] }}
            className={i >= desde ? 'resaltada' : undefined}
          >
            {palabra}
          </motion.span>
        </span>
      ))}
    </h2>
  );
};

/**
 * La cinta de frases que corre sin parar.
 *
 * El contenido se duplica y la animación recorre exactamente la mitad, así que
 * al terminar el ciclo la segunda copia está donde arrancó la primera y el
 * salto no se ve. Va en CSS y no en JS porque una animación de 30 segundos
 * corriendo en el hilo principal se nota en cuanto la página hace otra cosa.
 */
export const Ticker: React.FC<{ frases: readonly string[]; invertido?: boolean }> = ({
  frases,
  invertido = false,
}) => (
  <div className="ticker" aria-hidden>
    <div className={`ticker-pista ${invertido ? 'invertida' : ''}`}>
      {[0, 1].map((copia) => (
        <div className="ticker-grupo" key={copia}>
          {frases.map((f) => (
            <span className="ticker-item" key={f}>
              {f}
            </span>
          ))}
        </div>
      ))}
    </div>
  </div>
);

/**
 * Parallax vertical ligado al scroll. Mueve a su hijo un poco más lento que la
 * página, que es lo que da sensación de profundidad sin que nada se despegue.
 */
export const Parallax: React.FC<{
  children: React.ReactNode;
  /** Cuántos píxeles se desplaza en todo el recorrido. Negativo sube. */
  distancia?: number;
  className?: string;
}> = ({ children, distancia = -60, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const quieto = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, distancia]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={quieto ? undefined : { y }}>{children}</motion.div>
    </div>
  );
};

/**
 * Una línea que se dibuja sola de izquierda a derecha al entrar en pantalla.
 * Sirve de respiro entre secciones sin meter otro bloque de texto.
 */
export const LineaQueSeDibuja: React.FC = () => {
  const quieto = useReducedMotion();

  return (
    <motion.span
      className="linea-dibujada"
      initial={quieto ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      aria-hidden
    />
  );
};
