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

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      swipeStateRef.current.startX = e.touches[0].clientX;
      swipeStateRef.current.startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
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
