import React, { useRef } from 'react';
import { motion } from 'framer-motion';

interface RippleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  rippleColor?: string;
}

/**
 * Botón con efecto ripple suave (como iOS/Material Design pero más elegante).
 * Crea retroalimentación visual inmediata al presionar.
 */
export const RippleButton = React.forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({ children, rippleColor = 'rgba(255,255,255,0.4)', onClick, ...props }, ref) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [ripples, setRipples] = React.useState<
      Array<{ id: number; x: number; y: number }>
    >([]);
    const rippleIdRef = useRef(0);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const id = rippleIdRef.current++;

        setRipples((prev) => [...prev, { id, x, y }]);

        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 600);
      }

      onClick?.(e);
    };

    return (
      <button
        ref={ref || buttonRef}
        onClick={handleClick}
        className="relative overflow-hidden"
        {...props}
      >
        {ripples.map(({ id, x, y }) => (
          <motion.span
            key={id}
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 4, opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="pointer-events-none absolute block h-2 w-2 rounded-full"
            style={{
              backgroundColor: rippleColor,
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
        {children}
      </button>
    );
  },
);

RippleButton.displayName = 'RippleButton';
