import { useEffect, useRef } from 'react';

interface UseLongPressOptions {
  onLongPress: () => void;
  delay?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Hook para detectar long press (mantener presionado).
 * Útil para opciones contextuales o acciones secundarias.
 */
export const useLongPress = (
  elementRef: React.RefObject<HTMLElement>,
  { onLongPress, delay = 500, onStart, onEnd }: UseLongPressOptions,
) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleMouseDown = () => {
      isLongPressRef.current = false;
      onStart?.();

      timeoutRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress();
      }, delay);
    };

    const handleMouseUp = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      onEnd?.();
    };

    const handleMouseLeave = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      onEnd?.();
    };

    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('touchstart', handleMouseDown);
    element.addEventListener('touchend', handleMouseUp);
    element.addEventListener('touchcancel', handleMouseLeave);

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('touchstart', handleMouseDown);
      element.removeEventListener('touchend', handleMouseUp);
      element.removeEventListener('touchcancel', handleMouseLeave);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onLongPress, delay, onStart, onEnd]);

  return isLongPressRef;
};
