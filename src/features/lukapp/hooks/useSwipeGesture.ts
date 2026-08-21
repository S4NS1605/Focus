import { useEffect, useRef } from 'react';

interface SwipeState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

interface UseSwipeGestureOptions {
  onSwipe?: (direction: SwipeDirection) => void;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}

const SWIPE_THRESHOLD = 50;

/**
 * Cualquier elemento con este atributo (o descendiente de uno) cancela el
 * gesto para toda la hoja -- pensado para filas que se deslizan por dentro
 * (categorías, carruseles) sin que ese mismo arrastre se lea como "cerrar
 * todo". `stopPropagation()` en React NO alcanza para esto: este hook
 * engancha sus listeners con `addEventListener` nativo directo sobre el
 * elemento que se le pase, y en el DOM real ese listener del ancestro se
 * dispara ANTES de que React llegue a procesar un `stopPropagation`
 * sintético de un descendiente. Ya pasó una vez (ver Captura.tsx) y el
 * arreglo de entonces no evitaba nada -- esto lo evita de raíz, adentro del
 * propio hook, para que la próxima fila deslizable no tenga que acordarse.
 */
const ATRIBUTO_SIN_SWIPE = 'data-no-swipe';

const dentroDeZonaSinSwipe = (nodo: EventTarget | null): boolean =>
  nodo instanceof Element && nodo.closest(`[${ATRIBUTO_SIN_SWIPE}]`) !== null;

/**
 * Hook para detectar gestos de swipe en elementos táctiles.
 * Perfecto para navegación intuitiva (swipe right para atrás).
 */
export const useSwipeGesture = (
  elementRef: React.RefObject<HTMLElement>,
  options: UseSwipeGestureOptions = {},
) => {
  const {
    onSwipe,
    onSwipeRight,
    onSwipeLeft,
    onSwipeUp,
    onSwipeDown,
    threshold = SWIPE_THRESHOLD,
  } = options;

  const swipeStateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });
  // Se marca en touchstart si el toque empezó dentro de una zona `data-no-swipe`,
  // para que touchend también lo ignore (el target de `changedTouches` puede
  // no ser el mismo elemento si el dedo se movió).
  const ignorandoRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (dentroDeZonaSinSwipe(e.target)) {
        ignorandoRef.current = true;
        return;
      }
      ignorandoRef.current = false;
      swipeStateRef.current.startX = e.touches[0].clientX;
      swipeStateRef.current.startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (ignorandoRef.current) {
        ignorandoRef.current = false;
        return;
      }
      swipeStateRef.current.endX = e.changedTouches[0].clientX;
      swipeStateRef.current.endY = e.changedTouches[0].clientY;

      const { startX, startY, endX, endY } = swipeStateRef.current;
      const distanceX = Math.abs(endX - startX);
      const distanceY = Math.abs(endY - startY);

      // Swipe horizontal
      if (distanceX > threshold && distanceX > distanceY) {
        const direction: SwipeDirection = endX < startX ? 'left' : 'right';
        onSwipe?.(direction);

        if (direction === 'left') {
          onSwipeLeft?.();
        } else if (direction === 'right') {
          onSwipeRight?.();
        }
      }

      // Swipe vertical
      if (distanceY > threshold && distanceY > distanceX) {
        const direction: SwipeDirection = endY < startY ? 'up' : 'down';
        onSwipe?.(direction);

        if (direction === 'up') {
          onSwipeUp?.();
        } else if (direction === 'down') {
          onSwipeDown?.();
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart, false);
    element.addEventListener('touchend', handleTouchEnd, false);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart, false);
      element.removeEventListener('touchend', handleTouchEnd, false);
    };
  }, [onSwipe, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);
};
