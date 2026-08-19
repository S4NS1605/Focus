import { useEffect, useRef } from 'react';

/** Nunca se recarga dos veces seguidas antes de esto. */
const ESPERA_MINIMA_MS = 3000;

interface Opciones {
  /** Para poder apagarlo en pruebas. En la app va siempre encendido. */
  activo: boolean;
  recargar: () => Promise<void>;
}

/**
 * Mantiene la app al día sin tener que cerrarla y volverla a abrir.
 *
 * El problema que resuelve: la app lee todo UNA vez, al montarse, y a partir de
 * ahí solo escribe. En una pestaña del navegador eso casi no se nota, porque
 * recargar la página la vuelve a montar. Pero instalada en la pantalla de
 * inicio no: volver a ella la despierta sin montarla de nuevo, así que puede
 * pasar horas mostrando saldos de ayer mientras en el computador ya cambiaron.
 *
 * Se escucha en tres momentos, y los tres son el mismo momento visto de tres
 * formas, porque ningún sistema los dispara todos:
 *
 *   - `visibilitychange`: volviste a la app desde otra. Es el caso principal en
 *     celular y el que de verdad arregla la PWA.
 *   - `focus`: volviste a la ventana. Es el caso de escritorio, donde la app
 *     nunca se oculta pero sí pierde el foco.
 *   - `online`: volvió el internet. Sin esto, lo que cambió mientras no había
 *     señal no llega hasta la siguiente vez que sales y entras.
 *
 * Hay una espera mínima entre recargas porque estos tres eventos se disparan
 * juntos constantemente —cambiar de pestaña lanza `visibilitychange` y `focus`
 * casi a la vez— y sin ella cada alt-tab serían dos viajes al servidor.
 */
export const useSincronizacion = ({ activo, recargar }: Opciones): void => {
  // En refs y no en el array de dependencias: `recargar` se vuelve a crear en
  // cada render, y ponerlo como dependencia desmontaría y volvería a montar los
  // tres escuchadores continuamente.
  const recargarRef = useRef(recargar);
  const ultima = useRef(0);

  useEffect(() => {
    recargarRef.current = recargar;
  }, [recargar]);

  useEffect(() => {
    if (!activo) return;

    const quizaRecargar = () => {
      // `hidden` cubre el caso de `focus` disparado sobre una ventana que sigue
      // tapada por otra: no hay nada que refrescar si no se está viendo.
      if (document.visibilityState === 'hidden') return;
      const ahora = Date.now();
      if (ahora - ultima.current < ESPERA_MINIMA_MS) return;
      ultima.current = ahora;
      void recargarRef.current();
    };

    document.addEventListener('visibilitychange', quizaRecargar);
    window.addEventListener('focus', quizaRecargar);
    window.addEventListener('online', quizaRecargar);

    return () => {
      document.removeEventListener('visibilitychange', quizaRecargar);
      window.removeEventListener('focus', quizaRecargar);
      window.removeEventListener('online', quizaRecargar);
    };
  }, [activo]);
};
