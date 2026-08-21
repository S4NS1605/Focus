import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Mic, Search, Settings2 } from 'lucide-react';
import { TransactionList } from '../TransactionList';
import { CATALOGO_BASE } from '../../categorias';
import { formatCop } from '../../lib/formatCop';
import { monthKeyLabel } from '../../lib/localDate';
import { BarraEstado } from './BarraEstado';
import { CifraViva } from './CifraViva';
import { useEnPantalla, useTecleo } from './ganchos';
import {
  GASTOS_INICIALES,
  GUION,
  INGRESOS_INICIALES,
  MES_ACTUAL,
  MOVIMIENTOS_BASE,
  SALDO_INICIAL,
  movimientoDelPaso,
} from './guionDemo';

const MS_POR_LETRA = 45;

/**
 * Los tiempos de la cadena. La versión anterior no tenía ninguno: `setPaso`
 * cambiaba la fila, el saldo, los totales y el texto de la barra en un solo
 * commit, así que React lo pintaba todo en el mismo fotograma. La pantalla
 * pasaba del estado A al estado B sin nada en medio — no era que el número
 * fuera rápido, es que no había secuencia que leer. Eso era lo brusco.
 *
 * Ahora son tres tiempos, y el orden importa porque es el orden en que el ojo
 * tiene que ir: primero se entiende lo dicho, después se anota, y solo entonces
 * se mueve la plata.
 */
const MS_ANTES_DE_RECONOCER = 260;
const MS_RECONOCIDO = 620;
const MS_TRAS_APLICAR = 1500;
const MS_ANTES_DE_REINICIAR = 2400;
/** Lo que dura el desvanecido del mes antes de volver a empezar. */
const MS_REINICIANDO = 460;

/** Lo que mide una fila. Se necesita para animarle la altura al entrar. */
const ALTO_FILA = 75;

type Fase = 'tecleando' | 'reconocido' | 'aplicado' | 'reiniciando' | 'reapareciendo';

/**
 * El teléfono de la portada.
 *
 * La pantalla de adentro no es un dibujo parecido al dashboard: es el dashboard.
 * La lista de movimientos es el mismo `TransactionList` que corre en la app —
 * fuera de su provider cae en `CATALOGO_BASE`, que es justo para lo que ese
 * default existe— así que los iconos, los colores de categoría, el agrupado por
 * día y el formato de las cifras no pueden desincronizarse de lo que ve alguien
 * que ya usa Lukapp.
 *
 * Lo que sí es de la portada son los tokens: `lukapp.css` no se carga aquí, y
 * cargarlo entero por un mockup traería la hoja completa de la app. En su lugar
 * el contenedor `.pantalla-app` declara los `--fin-*` que la fila usa, mapeados
 * desde la paleta de la landing.
 */
export const MockupTelefono: React.FC = () => {
  const quieto = useReducedMotion();
  const { ref, enVista } = useEnPantalla<HTMLDivElement>(0.25);

  const [paso, setPaso] = useState(0);
  const [fase, setFase] = useState<Fase>('tecleando');
  const completo = paso >= GUION.length;
  const pasoActual = GUION[Math.min(paso, GUION.length - 1)];

  /* Con la pestaña de fondo no hay nada que animar y sí batería que gastar. Y
     al volver, el visitante caía en mitad del guion sin haber visto entrar un
     solo movimiento. */
  const [pestanaViva, setPestanaViva] = useState(true);
  useEffect(() => {
    const alCambiar = () => setPestanaViva(document.visibilityState === 'visible');
    alCambiar();
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);

  const corriendo = enVista && pestanaViva && !quieto;

  /* Con movimiento reducido se enseña el mes ya lleno y quieto. */
  const aplicados = quieto
    ? GUION.length
    : Math.min(paso + (fase === 'aplicado' || fase === 'reiniciando' ? 1 : 0), GUION.length);

  const reiniciando = fase === 'reiniciando';
  /* Las cifras no cuentan ni al apagarse ni al volver a cero. */
  const cifrasQuietas = reiniciando || fase === 'reapareciendo';

  /* El tecleo solo corre en su fase. Antes corría siempre, y como cambia estado
     cada 45ms re-renderizaba el teléfono entero 22 veces por segundo justo
     durante el segundo en que el número tenía que estar interpolando. */
  const { visible, listo } = useTecleo(
    completo ? '' : pasoActual.frase,
    corriendo && !completo && fase === 'tecleando',
    MS_POR_LETRA,
  );

  /* La máquina de estados del bucle. Cada fase agenda la siguiente. */
  useEffect(() => {
    if (!corriendo) return;

    /* El reinicio en dos tiempos. Antes el mes entero desaparecía en un
       fotograma y el saldo desandaba dos millones y medio contando hacia atrás:
       eso no se lee como "vuelve a empezar", se lee como que algo se rompió.
       Ahora el mes se desvanece primero y las cifras vuelven de un salto, sin
       contar, mientras la pantalla está en transición. */
    if (fase === 'reiniciando') {
      const id = setTimeout(() => {
        setPaso(0);
        setFase('reapareciendo');
      }, MS_REINICIANDO);
      return () => clearTimeout(id);
    }

    /* El mes vuelve a cero con la pantalla todavía apagada, y las cifras saltan
       en vez de contar. Sin este respiro los valores cambiaban ya con la
       pantalla encendida y se veía el saldo desandar dos millones. */
    if (fase === 'reapareciendo') {
      const id = setTimeout(() => setFase('tecleando'), 90);
      return () => clearTimeout(id);
    }

    if (completo) {
      const id = setTimeout(() => setFase('reiniciando'), MS_ANTES_DE_REINICIAR);
      return () => clearTimeout(id);
    }

    if (fase === 'tecleando') {
      if (!listo) return;
      const id = setTimeout(() => setFase('reconocido'), MS_ANTES_DE_RECONOCER);
      return () => clearTimeout(id);
    }

    if (fase === 'reconocido') {
      const id = setTimeout(() => setFase('aplicado'), MS_RECONOCIDO);
      return () => clearTimeout(id);
    }

    const id = setTimeout(() => {
      setPaso((n) => n + 1);
      setFase('tecleando');
    }, MS_TRAS_APLICAR);
    return () => clearTimeout(id);
  }, [corriendo, completo, fase, listo]);

  const nuevos = GUION.slice(0, aplicados).map(movimientoDelPaso);
  const movimientos = [...nuevos, ...MOVIMIENTOS_BASE];

  const suma = (f: (t: (typeof nuevos)[number]) => number) => nuevos.reduce((s, t) => s + f(t), 0);
  const saldo = SALDO_INICIAL + suma((t) => (t.kind === 'ingreso' ? t.amountCop : -t.amountCop));
  const gastos = GASTOS_INICIALES + suma((t) => (t.kind === 'gasto' ? t.amountCop : 0));
  const ingresos = INGRESOS_INICIALES + suma((t) => (t.kind === 'ingreso' ? t.amountCop : 0));

  /* LA ENTRADA DE LA FILA
     Se anima el nodo directamente con framer y no con estado de React: el
     teléfono se re-renderiza muchas veces por segundo y cualquier animación
     gobernada desde el árbol se reiniciaría a media pista, que es exactamente
     lo que le pasaba al contador.

     La altura va de 0 a su tamaño para que la lista de abajo se aparte
     deslizándose. Antes la fila aparecía hecha y empujaba dos tercios de la
     pantalla 75px en un fotograma. */
  const listaRef = useRef<HTMLDivElement>(null);
  const gruposPrevios = useRef(0);

  useLayoutEffect(() => {
    const cont = listaRef.current;
    if (!cont) return;

    const grupos = cont.querySelectorAll('section').length;
    const nacioGrupo = grupos > gruposPrevios.current;
    gruposPrevios.current = grupos;

    if (quieto || aplicados === 0) return;

    /* Si el movimiento estrena día, lo que entra es la sección con su cabecera;
       si no, la primera fila. Animar la fila cuando acaba de nacer el grupo
       dejaría la cabecera "Hoy" apareciendo de golpe encima. */
    const nodo = nacioGrupo
      ? cont.querySelector('section')
      : cont.querySelector('section')?.querySelector('li');
    if (!(nodo instanceof HTMLElement)) return;

    const alto = nacioGrupo ? nodo.offsetHeight : ALTO_FILA;
    nodo.style.overflow = 'hidden';

    const control = animate(
      nodo,
      { height: [0, alto], opacity: [0, 1] },
      { duration: 0.52, ease: [0.22, 1, 0.36, 1] },
    );
    control.then(() => {
      nodo.style.height = '';
      nodo.style.overflow = '';
      nodo.style.opacity = '';
    });

    return () => control.stop();
  }, [aplicados, quieto]);

  const categoria = CATALOGO_BASE.de(pasoActual.category);
  const esIngreso = pasoActual.kind === 'ingreso';
  /* Tokens de la landing y no de la app: los --fin-* solo existen dentro de
     `.pantalla-app`, y la barra del micrófono cuelga del marco, fuera de ella.
     Con --fin-out el botón se quedaba sin fondo. Son el mismo color: la
     pantalla mapea --fin-out a --lp-out. */
  const colorMovimiento = esIngreso ? 'var(--lp-in)' : 'var(--lp-out)';
  const montoFirmado = `${esIngreso ? '+' : '−'}${formatCop(pasoActual.amountCop)}`;
  const reconociendo = !quieto && !completo && (fase === 'reconocido' || fase === 'aplicado');

  /* La frase se queda entera cuando deja de teclearse. `useTecleo` la vacía al
     apagarse —es lo suyo, sirve para escribir— pero leer de él fuera de su fase
     borraba la frase en el mismísimo instante en que aparecía su consecuencia.
     Se destruía la causa en el momento del efecto: el visitante nunca llegaba a
     ver juntas "mercado en el éxito 180 mil" y la fila "Mercado −$184.200", que
     es lo único que este mockup tiene que demostrar. */
  const textoBarra = quieto
    ? 'gasté 45 mil en almuerzo'
    : fase === 'tecleando'
      ? visible
      : pasoActual.frase;

  return (
    <div className="telefono-envoltura" ref={ref} aria-hidden="true">
      <div className="telefono-marco">
        <span className="telefono-boton-accion" />
        <span className="telefono-boton-vol arriba" />
        <span className="telefono-boton-vol abajo" />
        <span className="telefono-boton-lateral" />

        <div className="telefono-pantalla">
          <span className="isla-dinamica" />
          <BarraEstado />

          <div className={`pantalla-app ${reiniciando ? 'reiniciando' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3.5 py-2 text-[15px] font-semibold capitalize text-[var(--fin-ink)]">
                {monthKeyLabel(MES_ACTUAL)}
                <ChevronDown className="h-4 w-4 text-[var(--fin-ink-faint)]" strokeWidth={2.5} />
              </span>

              <div className="flex gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
                  <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
                  <Settings2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
              </div>
            </div>

            <p className="mt-6 text-center text-[13px] text-[var(--fin-ink-faint)]">Tienes en total</p>

            {/* El saldo, y pegada a él la cifra de lo que acaba de cambiar. Esa
                pastilla es la que hace legible "la suma": sin ella el número
                grande se mueve y el visitante ve que cambió, pero no CUÁNTO. */}
            <div className="saldo-zona">
              <div
                className="text-center tabular-nums text-[var(--fin-ink)]"
                style={{ font: 'var(--fin-t-cifra)', letterSpacing: 'var(--fin-track-cifra)' }}
              >
                <CifraViva valor={saldo} formato={formatCop} animar={!cifrasQuietas} />
              </div>

              {fase === 'aplicado' && !completo && !quieto && (
                <motion.span
                  key={paso}
                  className="saldo-delta"
                  style={{ color: colorMovimiento }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [6, -2, -6, -16] }}
                  transition={{ duration: 1.5, times: [0, 0.18, 0.62, 1], ease: 'easeOut' }}
                >
                  {montoFirmado}
                </motion.span>
              )}
            </div>

            <div className="mt-4 flex justify-center">
              <div className="flex overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
                <span
                  className="px-4 py-2.5 text-[17px] font-semibold tabular-nums"
                  style={{ color: 'var(--fin-out)' }}
                >
                  ↓ <CifraViva valor={gastos} formato={formatCop} animar={!cifrasQuietas} retraso={180} />
                </span>
                <span
                  className="border-l border-[var(--fin-line)] px-4 py-2.5 text-[17px] font-semibold tabular-nums"
                  style={{ color: 'var(--fin-in)' }}
                >
                  ↑ <CifraViva valor={ingresos} formato={formatCop} animar={!cifrasQuietas} retraso={180} />
                </span>
              </div>
            </div>

            <div className="mt-7" ref={listaRef}>
              <TransactionList transactions={movimientos} />
            </div>
          </div>

          {/* LA BARRA DEL MICRÓFONO
              La frase ya no se borra en el instante en que aparece su
              consecuencia. Se queda, y a su lado nace la pastilla con lo que la
              app entendió. Así el visitante ve por primera vez juntas la causa
              —"gasté 45 mil en almuerzo"— y el efecto —Comida, −$45.000—, que
              es lo único que este mockup tiene que demostrar. */}
          <div className={`barra-dictado ${reconociendo ? 'reconociendo' : ''}`}>
            <span className="dictado-boton" style={reconociendo ? { background: colorMovimiento } : undefined}>
              <Mic size={17} strokeWidth={2} />
              {corriendo && !completo && fase === 'tecleando' && !listo && (
                <span className="dictado-pulso" />
              )}
            </span>

            <span className="dictado-texto">
              {textoBarra}
              {corriendo && !completo && fase === 'tecleando' && !listo && (
                <span className="dictado-cursor" />
              )}
            </span>

            {reconociendo && (
              <motion.span
                key={`chip-${paso}`}
                className="dictado-entendido"
                style={{ background: `${categoria.color}1f`, color: categoria.color }}
                initial={{ opacity: 0, scale: 0.8, x: 8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
              >
                <categoria.Icono size={13} strokeWidth={2.4} />
                {categoria.nombre}
              </motion.span>
            )}
          </div>

          <span className="pantalla-velo" />
          <span className="indicador-inicio" />
        </div>
      </div>
    </div>
  );
};
