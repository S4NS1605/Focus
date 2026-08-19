import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMostrarAhorro } from './usePreferencias';

const CLAVE = 'finanzas:resumen:ahorro';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMostrarAhorro', () => {
  it('cuenta los ahorros mientras nadie diga lo contrario', () => {
    const { result } = renderHook(() => useMostrarAhorro());

    expect(result.current.mostrarAhorro).toBe(true);
  });

  it('recuerda la elección entre sesiones', () => {
    const primera = renderHook(() => useMostrarAhorro());
    act(() => primera.result.current.setMostrarAhorro(false));
    primera.unmount();

    const segunda = renderHook(() => useMostrarAhorro());
    expect(segunda.result.current.mostrarAhorro).toBe(false);
  });

  it('vuelve a contarlos si se enciende de nuevo', () => {
    const { result } = renderHook(() => useMostrarAhorro());

    act(() => result.current.setMostrarAhorro(false));
    act(() => result.current.setMostrarAhorro(true));

    expect(result.current.mostrarAhorro).toBe(true);
    expect(renderHook(() => useMostrarAhorro()).result.current.mostrarAhorro).toBe(true);
  });

  it('ignora un valor guardado que no reconoce', () => {
    // Una clave pisada a mano, o dejada por una versión anterior, no debería
    // dejar el resumen en un estado que nadie eligió.
    localStorage.setItem(CLAVE, 'quizá');

    expect(renderHook(() => useMostrarAhorro()).result.current.mostrarAhorro).toBe(true);
  });

  it('sigue funcionando donde localStorage lanza, como Safari privado', () => {
    // El interruptor tiene que responder aunque no se pueda recordar: fallar al
    // guardar no es razón para que la pantalla deje de reaccionar.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useMostrarAhorro());
    act(() => result.current.setMostrarAhorro(false));

    expect(result.current.mostrarAhorro).toBe(false);
  });

  it('arranca en el valor por defecto si ni siquiera se puede leer', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(renderHook(() => useMostrarAhorro()).result.current.mostrarAhorro).toBe(true);
  });

  it('una pestaña se entera del cambio hecho en otra', () => {
    // `storage` solo llega a las OTRAS pestañas. Sin esto, dos pestañas abiertas
    // muestran totales distintos del mismo dinero hasta que una recargue.
    const { result } = renderHook(() => useMostrarAhorro());
    expect(result.current.mostrarAhorro).toBe(true);

    act(() => {
      localStorage.setItem(CLAVE, 'no');
      window.dispatchEvent(new StorageEvent('storage', { key: CLAVE, newValue: 'no' }));
    });

    expect(result.current.mostrarAhorro).toBe(false);
  });

  it('no reacciona a otra clave del mismo origen', () => {
    const { result } = renderHook(() => useMostrarAhorro());

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'finanzas:tema', newValue: 'oscuro' }),
      );
    });

    expect(result.current.mostrarAhorro).toBe(true);
  });

  it('se recalcula cuando se limpia todo el almacenamiento', () => {
    // Un `localStorage.clear()` llega como un evento con key === null.
    const { result } = renderHook(() => useMostrarAhorro());
    act(() => result.current.setMostrarAhorro(false));

    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });

    expect(result.current.mostrarAhorro).toBe(true);
  });
});
