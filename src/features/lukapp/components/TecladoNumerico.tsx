import React from 'react';
import { Delete } from 'lucide-react';

interface TecladoNumericoProps {
  /** Se llama con el dígito o los dígitos que se tocaron ('7', '000'). */
  onDigito: (digitos: string) => void;
  /** Borra el último dígito. */
  onBorrar: () => void;
}

/**
 * El teclado de números de la app, dibujado por nosotros.
 *
 * ¿Por qué no usar el del celular? Porque el del sistema:
 * 1. mide unos 300px y empuja hacia arriba todo lo que hay en pantalla,
 * 2. en iPhone hace zoom solo si la letra baja de 16px y no lo deshace,
 * 3. tarda un momento en aparecer.
 * Este sale al instante, no mueve nada y deja el monto siempre a la vista
 * mientras lo escribes, que es justo lo que uno quiere mirar.
 *
 * La tecla "000" está porque aquí los precios son en miles: escribir 45 mil
 * son dos toques (4, 5) más uno (000), no cinco.
 */
export const TecladoNumerico: React.FC<TecladoNumericoProps> = ({ onDigito, onBorrar }) => {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0'];

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado de números">
      {teclas.map((tecla) => (
        <button
          key={tecla}
          type="button"
          onClick={() => onDigito(tecla)}
          // active:scale en vez de una animación: el toque tiene que responder
          // en el mismo instante, no dentro de 150ms.
          className="h-14 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] text-[22px] font-semibold text-[var(--fin-ink)] tabular-nums transition-transform active:scale-95"
        >
          {tecla}
        </button>
      ))}
      <button
        type="button"
        onClick={onBorrar}
        aria-label="Borrar el último número"
        className="flex h-14 items-center justify-center rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] transition-transform active:scale-95"
      >
        <Delete className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
};
