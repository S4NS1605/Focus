import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PasoGuia } from './pasos';

interface GuiaAppProps {
  pasos: PasoGuia[];
  /** Se llama al llegar al final o al saltar. En los dos casos se da por vista. */
  onCerrar: () => void;
}

interface Caja {
  top: number;
  left: number;
  width: number;
  height: number;
}

const ANCHO_GLOBO = 320;
/** Lo que se separa el globo de lo que señala. */
const SEPARACION = 14;
/** Debajo de esto no cabe un globo, así que se pone encima. */
const ESPACIO_MINIMO = 210;
/** Margen contra el canto de la pantalla. */
const MARGEN = 16;

const igual = (a: Caja | null, b: Caja | null): boolean => {
  if (a === null || b === null) return a === b;
  return (
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height)
  );
};

/**
 * Los globos que explican la app señalando la app.
 *
 * Cada paso busca su elemento por `data-guia`, lo recorta del oscurecido y le
 * pone al lado una tarjeta. La guía no importa ni un componente de las vistas
 * que explica: el único acoplamiento es ese atributo, así que se puede rehacer
 * una pantalla entera sin tocar este archivo.
 *
 * Si un ancla no aparece —una vista que cambió, un elemento que solo existe con
 * datos— el globo se pinta centrado y sin recorte en vez de romperse. El texto
 * se sostiene solo; lo que se pierde es el dedo que señala, no la explicación.
 */
export const GuiaApp: React.FC<GuiaAppProps> = ({ pasos, onCerrar }) => {
  const quieto = useReducedMotion();
  const [indice, setIndice] = useState(0);
  const [caja, setCaja] = useState<Caja | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  const paso = pasos[Math.min(indice, pasos.length - 1)];
  const ultimo = indice >= pasos.length - 1;

  const avanzar = useCallback(() => {
    if (ultimo) onCerrar();
    else setIndice((n) => n + 1);
  }, [ultimo, onCerrar]);

  /* LA MEDIDA
     Se remide en cada fotograma en vez de escuchar `scroll` y `resize`, y es a
     posta: el elemento señalado puede moverse por cosas que no emiten ningún
     evento —una lista que termina de cargar y empuja el saldo, el teclado del
     móvil, una animación de entrada— y con listeners el recorte se quedaba
     descolocado justo en esos casos. El coste real es una comparación de cuatro
     números por fotograma, porque `setCaja` devuelve el estado anterior cuando
     nada cambió y ahí React no vuelve a pintar. */
  useLayoutEffect(() => {
    let vivo = true;
    let id = 0;

    const leer = (): Caja | null => {
      const el = document.querySelector(`[data-guia="${paso.ancla}"]`);
      const r = el?.getBoundingClientRect();
      return r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
    };

    const aplicar = () => setCaja((previa) => (igual(previa, leer()) ? previa : leer()));

    /* La primera medida va aquí y no dentro del bucle: si se deja que la tome
       el primer fotograma, todo lo que retrase `requestAnimationFrame` —una
       pestaña en segundo plano, el ahorro de batería del teléfono— deja el
       primer pintado sin recorte, con el velo tapando entera la pantalla que
       se está intentando explicar. En `useLayoutEffect` la medida ocurre antes
       de pintar, así que el foco sale bien puesto desde el primer fotograma
       aunque el bucle tarde en arrancar. */
    aplicar();

    const medir = () => {
      if (!vivo) return;
      aplicar();
      id = requestAnimationFrame(medir);
    };

    id = requestAnimationFrame(medir);
    return () => {
      vivo = false;
      cancelAnimationFrame(id);
    };
  }, [paso.ancla]);

  /* Si lo señalado quedó fuera de la ventana se sube solo. Sin esto el primer
     paso apunta al saldo mientras la persona está a media pantalla de scroll y
     el recorte ilumina un trozo de nada. */
  useEffect(() => {
    const el = document.querySelector(`[data-guia="${paso.ancla}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fuera = r.top < MARGEN || r.bottom > window.innerHeight - MARGEN;
    if (fuera) el.scrollIntoView({ block: 'center', behavior: quieto ? 'auto' : 'smooth' });
  }, [paso.ancla, quieto]);

  useEffect(() => {
    botonRef.current?.focus();
  }, [indice]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCerrar();
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const aire = paso.aire ?? 8;
  const vh = typeof window === 'undefined' ? 0 : window.innerHeight;
  const vw = typeof window === 'undefined' ? 0 : window.innerWidth;
  const ancho = Math.min(ANCHO_GLOBO, vw - MARGEN * 2);

  /* El globo se coloca con `top` si va debajo y con `bottom` si va encima, y
     nunca con las dos. Así no hace falta medir su altura para saber dónde
     empieza: puesto por abajo, crece hacia arriba solo. Medirla obligaría a
     pintarlo antes de saber dónde ponerlo, y eso se ve como un salto. */
  /* `x`/`y` y no `transform: 'translate(...)'`: en cuanto se anima `scale` en
     el mismo `motion.div`, Framer Motion toma el control completo de la
     propiedad `transform` y descarta cualquier valor puesto a mano en
     `style.transform`. Con eso el centrado desaparecía y la tarjeta quedaba
     con su borde izquierdo —no su centro— donde debía estar el centro,
     empujada hacia la derecha y cortada contra el canto de la pantalla.
     `x`/`y` sí son motion values: Framer los combina con el resto en vez de
     pisarlos. */
  let estilo: React.CSSProperties & { x?: string | number; y?: string | number };
  if (caja === null) {
    estilo = { top: '50%', left: '50%', x: '-50%', y: '-50%', width: ancho };
  } else {
    const espacioAbajo = vh - (caja.top + caja.height);
    const debajo = espacioAbajo > ESPACIO_MINIMO;
    const centro = caja.left + caja.width / 2;
    const izquierda = Math.max(
      MARGEN + ancho / 2,
      Math.min(centro, vw - MARGEN - ancho / 2),
    );

    estilo = {
      left: izquierda,
      x: '-50%',
      width: ancho,
      ...(debajo
        ? { top: caja.top + caja.height + aire + SEPARACION }
        : { bottom: vh - caja.top + aire + SEPARACION }),
    };
  }

  return (
    <>
      {/* El bloqueador. El oscurecido lo pinta el recorte con su sombra, pero
          una sombra no para un clic: sin esta capa se puede tocar la app por
          debajo del velo y navegar a otra pantalla con la guía abierta,
          dejándola señalando algo que ya no está. */}
      <div className="fixed inset-0 z-[60]" onClick={(e) => e.stopPropagation()} aria-hidden />

      {caja !== null ? (
        <motion.div
          className="pointer-events-none fixed z-[61]"
          aria-hidden
          initial={false}
          animate={{
            top: caja.top - aire,
            left: caja.left - aire,
            width: caja.width + aire * 2,
            height: caja.height + aire * 2,
          }}
          transition={quieto ? { duration: 0 } : { duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          style={{
            borderRadius: paso.radio ?? 12,
            /* El anillo va en blanco translúcido y no en color de acento: el
               velo es siempre oscuro en los dos temas, así que un borde claro
               se ve en ambos, mientras que el acento se vuelve tinta negra
               sobre negro en cuanto el tema es claro. */
            boxShadow: '0 0 0 2px rgba(255,255,255,0.5), 0 0 0 9999px rgba(12,10,9,0.66)',
          }}
        />
      ) : (
        <div className="fixed inset-0 z-[61] bg-[rgba(12,10,9,0.66)]" aria-hidden />
      )}

      <motion.div
        key={indice}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guia-titulo"
        className="fixed z-[62] rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5 shadow-[0_20px_60px_rgb(0_0_0/0.35)]"
        style={estilo}
        initial={quieto ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2
          id="guia-titulo"
          className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--fin-ink)]"
        >
          {paso.titulo}
        </h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--fin-ink-soft)]">{paso.texto}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {pasos.map((p, i) => (
              <span
                key={p.ancla}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === indice ? 16 : 6,
                  background: i === indice ? 'var(--fin-ink)' : 'var(--fin-ink-ghost)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            {!ultimo ? (
              <button
                type="button"
                onClick={onCerrar}
                className="rounded-[var(--fin-r-pill)] px-3 py-2 text-[14px] font-semibold text-[var(--fin-ink-faint)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
              >
                Saltar
              </button>
            ) : null}
            <button
              ref={botonRef}
              type="button"
              onClick={avanzar}
              className="rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-4 py-2 text-[14px] font-semibold text-[var(--fin-on-accent)] transition-transform active:scale-95"
            >
              {ultimo ? 'Entendido' : 'Siguiente'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};
