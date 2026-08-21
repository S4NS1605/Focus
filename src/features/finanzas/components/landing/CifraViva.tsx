import React, { useEffect, useRef } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'framer-motion';

/**
 * Un número que rueda de su valor anterior al nuevo cada vez que cambia.
 *
 * La versión anterior no llegaba a animar nunca. Tenía dos fallos que se
 * tapaban el uno al otro, y los dos están arreglados aquí:
 *
 * 1. Renderizaba `{formato(valor)}` como hijo Y ADEMÁS escribía el nodo desde
 *    un requestAnimationFrame. React pintaba el valor final primero y el efecto
 *    rebobinaba después, así que cada paso empezaba con un salto hacia atrás.
 *
 * 2. `formato` llega como flecha inline, o sea con identidad nueva en cada
 *    render del padre, y estaba en las dependencias del efecto. El teléfono
 *    teclea la frase del guion cada 45ms, así que el padre se re-renderiza
 *    constantemente: el efecto se limpiaba y volvía a correr antes del segundo
 *    frame, y para entonces ya se había apuntado el valor nuevo como origen.
 *    Delta cero. Medido en el navegador: 16 repintados en 12 segundos, uno por
 *    paso. El saldo no contaba, saltaba.
 *
 * La cura es sacar el número del árbol de React. Vive en un MotionValue, que es
 * ajeno al ciclo de renderizado, y el texto se escribe desde su suscripción.
 * Un render del padre ya no puede tumbar la animación porque no la toca.
 */
export const CifraViva: React.FC<{
  valor: number;
  formato: (n: number) => string;
  /** En ms. Si no se da, se calcula a partir de lo que salte la cifra. */
  duracion?: number;
  /**
   * Al vuelo el número se redondea a este múltiplo. Los pesos no tienen
   * centavos y los tres últimos dígitos de una cifra de siete girando a 60fps
   * son ruido: se lee "$5.6xx.xxx" enseguida y el resto tiembla. Redondeando a
   * miles se mueve lo que se puede leer y se queda quieto lo que no. Al
   * terminar se escribe el valor exacto.
   */
  redondeo?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Se llama cuando arranca un tramo, con lo que cambia. Para reaccionar al salto. */
  onCambio?: (delta: number) => void;
  /**
   * En false la cifra salta al valor sin contar. Es lo que se quiere en el
   * reinicio del bucle: ver el saldo desandar dos millones y medio hacia atrás
   * no se lee como "vuelve a empezar", se lee como un error.
   */
  animar?: boolean;
  /** Espera esto antes de arrancar, en ms. Sirve para escalonar varias cifras. */
  retraso?: number;
}> = ({
  valor,
  formato,
  duracion,
  redondeo = 1000,
  className,
  style,
  onCambio,
  animar = true,
  retraso = 0,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const numero = useMotionValue(valor);
  const quieto = useReducedMotion();

  /* En refs y no en dependencias: las dos llegan con identidad nueva en cada
     render del padre, y meterlas en el array es exactamente lo que rompía la
     versión anterior. */
  const fmt = useRef(formato);
  fmt.current = formato;
  const avisar = useRef(onCambio);
  avisar.current = onCambio;

  /* El texto se escribe aquí, fuera de React. `useMotionValue` no notifica el
     valor inicial, así que la primera pasada la hace el render de abajo. */
  useEffect(
    () =>
      numero.on('change', (v) => {
        if (ref.current) ref.current.textContent = fmt.current(Math.round(v / redondeo) * redondeo);
      }),
    [numero, redondeo],
  );

  useEffect(() => {
    if (quieto || !animar) {
      numero.set(valor);
      if (ref.current) ref.current.textContent = fmt.current(valor);
      return;
    }

    const delta = valor - numero.get();
    if (delta === 0) return;
    avisar.current?.(delta);

    /* `animate` arranca desde donde esté el valor ahora mismo, así que si llega
       un cambio a mitad de camino el número sigue desde donde iba en vez de
       teletransportarse al origen del tramo nuevo.

       La duración crece con el salto, en escala logarítmica. Con una fija, un
       Uber de $15.300 tarda lo mismo en mover dos dígitos que el pago del
       proyecto en mover seis: el primero se siente vacío y el segundo un
       borrón. Así cada cifra tarda lo que pide su tamaño. */
    const segundos =
      duracion !== undefined
        ? duracion / 1000
        : Math.min(1.45, Math.max(0.6, 0.6 + 0.3 * Math.log10(Math.abs(delta) / 10_000)));

    /* easeOutQuint y no easeOutExpo. La expo terminaba el 94% del recorrido en
       los primeros 430ms y dejaba medio segundo largo en el que el número ya
       había llegado pero la animación seguía: un fogonazo y luego un goteo, que
       es justo lo que se leía como brusco. Esta reparte mucho mejor. */
    const control = animate(numero, valor, {
      duration: segundos,
      delay: retraso / 1000,
      ease: [0.22, 1, 0.36, 1],
      // El valor exacto, sin redondear, solo al final.
      onComplete: () => {
        if (ref.current) ref.current.textContent = fmt.current(valor);
      },
    });
    return () => control.stop();
  }, [valor, duracion, quieto, numero, animar, retraso]);

  /* El hijo es una constante capturada en el primer render: React lo ve igual
     siempre y no vuelve a tocar el nodo, así que no le pisa el texto a la
     animación. Y a la vez el primer pintado sale con el valor correcto. */
  const inicial = useRef(formato(valor));

  return (
    <span ref={ref} className={className} style={style}>
      {inicial.current}
    </span>
  );
};
