import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSincronizacion } from './useSincronizacion';

/** Finge que la pestaña se ve o no se ve. */
const verse = (estado: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    value: estado,
    configurable: true,
  });
};

const volverALaApp = () => {
  verse('visible');
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('useSincronizacion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    verse('visible');
  });
  afterEach(() => vi.useRealTimers());

  it('recarga cuando vuelves a la app', () => {
    const recargar = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useSincronizacion({ activo: true, recargar }));

    volverALaApp();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('no recarga si la app sigue tapada', () => {
    const recargar = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useSincronizacion({ activo: true, recargar }));

    // `focus` también se dispara sobre una ventana que sigue oculta detrás de
    // otra; no hay nada que refrescar si nadie la está viendo.
    verse('hidden');
    window.dispatchEvent(new Event('focus'));
    expect(recargar).not.toHaveBeenCalled();
  });

  it('no recarga dos veces seguidas: cambiar de ventana dispara varios eventos a la vez', () => {
    const recargar = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useSincronizacion({ activo: true, recargar }));

    volverALaApp();
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));

    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('vuelve a recargar pasada la espera mínima', () => {
    const recargar = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useSincronizacion({ activo: true, recargar }));

    volverALaApp();
    vi.advanceTimersByTime(3500);
    volverALaApp();

    expect(recargar).toHaveBeenCalledTimes(2);
  });

  it('recarga cuando vuelve el internet', () => {
    const recargar = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useSincronizacion({ activo: true, recargar }));

    window.dispatchEvent(new Event('online'));
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('no hace nada en modo local: no hay nadie más escribiendo', () => {
    const recargar = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useSincronizacion({ activo: false, recargar }));

    volverALaApp();
    window.dispatchEvent(new Event('focus'));
    expect(recargar).not.toHaveBeenCalled();
  });

  it('deja de escuchar al desmontarse', () => {
    const recargar = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useSincronizacion({ activo: true, recargar }));

    unmount();
    volverALaApp();
    expect(recargar).not.toHaveBeenCalled();
  });

  it('usa siempre el `recargar` más reciente, no el del primer render', () => {
    // Si el hook se quedara con el primero, escribiría en un almacén viejo tras
    // un cambio de cuenta.
    const viejo = vi.fn().mockResolvedValue(undefined);
    const nuevo = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(({ r }) => useSincronizacion({ activo: true, recargar: r }), {
      initialProps: { r: viejo },
    });

    rerender({ r: nuevo });
    volverALaApp();

    expect(viejo).not.toHaveBeenCalled();
    expect(nuevo).toHaveBeenCalledTimes(1);
  });
});
