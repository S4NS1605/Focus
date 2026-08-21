import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number | null;
  className?: string;
  format?: (n: number) => string;
}

/**
 * Anima números cuando cambian de valor.
 * Los números fluyen visualmente para indicar cambio.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  className = '',
  format = (n) => n.toString(),
}) => {
  const prevValueRef = useRef<number | null>(value);
  const [displayValue, setDisplayValue] = React.useState(value);
  const [isChanging, setIsChanging] = React.useState(false);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      setIsChanging(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsChanging(false);
      }, 150);

      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <motion.span
      className={className}
      key={displayValue}
      initial={isChanging ? { opacity: 0, y: -10 } : undefined}
      animate={isChanging ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.3 }}
    >
      {displayValue === null ? '0' : format(displayValue)}
    </motion.span>
  );
};
