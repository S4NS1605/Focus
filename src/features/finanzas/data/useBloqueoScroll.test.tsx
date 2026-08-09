import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useBloqueoScroll } from './useBloqueoScroll';

const Hoja: React.FC<{ activo?: boolean }> = ({ activo = true }) => {
  useBloqueoScroll(activo);
  return null;
};

const bloqueado = () => document.body.style.position === 'fixed';

beforeEach(() => {
  document.body.style.cssText = '';
  window.scrollTo = vi.fn((_x?: unknown, y?: unknown) => {
    Object.defineProperty(window, 'scrollY', { value: y ?? 0, configurable: true });
  }) as typeof window.scrollTo;
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

describe('useBloqueoScroll', () => {
  it('congela la página mientras la hoja está abierta y la suelta al cerrar', () => {
    const vista = render(<Hoja />);
    expect(bloqueado()).toBe(true);

    vista.unmount();
    expect(bloqueado()).toBe(false);
  });

  it('devuelve la página a donde estaba, no al principio', () => {
    // Sin esto, abrir una hoja a mitad de una lista larga de movimientos la
    // cerraría de vuelta arriba del todo: `position: fixed` colapsa el offset.
    Object.defineProperty(window, 'scrollY', { value: 940, configurable: true });

    const vista = render(<Hoja />);
    expect(document.body.style.top).toBe('-940px');

    vista.unmount();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 940);
  });

  it('con dos hojas apiladas, cerrar la de arriba no desbloquea la de abajo', () => {
    const fondo = render(<Hoja />);
    const encima = render(<Hoja />);

    encima.unmount();
    expect(bloqueado()).toBe(true);

    fondo.unmount();
    expect(bloqueado()).toBe(false);
  });

  it('no toca nada mientras la hoja está cerrada', () => {
    render(<Hoja activo={false} />);
    expect(bloqueado()).toBe(false);
  });

  it('sigue el estado cuando la hoja se abre y se cierra sin desmontarse', () => {
    const vista = render(<Hoja activo={false} />);
    expect(bloqueado()).toBe(false);

    vista.rerender(<Hoja activo={true} />);
    expect(bloqueado()).toBe(true);

    vista.rerender(<Hoja activo={false} />);
    expect(bloqueado()).toBe(false);

    cleanup();
  });
});
