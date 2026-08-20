import React from 'react';
import { formatAmountInput, parseAmountInput, parseSaldoInput } from '../lib/formatCop';

interface InputDineroProps {
  /** El valor en centavos (o null). */
  value: number | null;
  /** Se llama cuando el usuario cambia el input, pasando el NÚMERO o null. */
  onChange: (value: number | null) => void;
  /** 'cantidad' = rechaza $0, 'saldo' = acepta $0. */
  tipo?: 'cantidad' | 'saldo';
  /** Props estándar de input. */
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * Input de dinero que formatea automáticamente.
 *
 * Mientras escribes, ves los puntos separadores de miles aparecer en tiempo
 * real. El valor se devuelve como número puro al padre, y acepta input de
 * cualquier formato (con o sin puntos, con comas, etc).
 */
export const InputDinero = React.forwardRef<HTMLInputElement, InputDineroProps>(
  (
    {
      value,
      onChange,
      tipo = 'cantidad',
      placeholder = '0',
      autoFocus,
      disabled,
      id,
      'aria-label': ariaLabel,
      className = '',
    },
    ref,
  ) => {
    // El estado local es el TEXT que se muestra, formateado.
    const [texto, setTexto] = React.useState(() => {
      return value === null ? '' : formatAmountInput(value);
    });

    // Cuando el padre cambia el valor (ej: editar una deuda), sincroniza.
    React.useEffect(() => {
      setTexto(value === null ? '' : formatAmountInput(value));
    }, [value]);

    const manejarCambio = (e: React.ChangeEvent<HTMLInputElement>) => {
      const nuevoTexto = e.target.value;
      setTexto(nuevoTexto);

      // Parsea: tolera cualquier formato de entrada.
      const leer = tipo === 'saldo' ? parseSaldoInput : parseAmountInput;
      const numero = leer(nuevoTexto);

      // Devuelve al padre, y reformatea el texto para que se vea bonito.
      onChange(numero);
      if (numero !== null) {
        setTexto(formatAmountInput(numero));
      }
    };

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={texto}
        onChange={manejarCambio}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        id={id}
        aria-label={ariaLabel}
        className={`w-full bg-transparent text-[20px] font-semibold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none ${className}`}
      />
    );
  },
);

InputDinero.displayName = 'InputDinero';
