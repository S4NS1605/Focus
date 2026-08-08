import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { Transaction } from '../types';
import { RepositorioMemoria } from './repositorio';
import type { Repositorio } from './repositorio';
import { saldoDeCajita } from '../lib/cajitas';
import { useAlmacen } from './useAlmacen';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  kind: 'gasto',
  amountCop: 20000,
  category: 'comida',
  description: 'Almuerzo',
  occurredOn: '2026-08-06',
  rawTranscript: '',
  createdAt: '2026-08-06T12:00:00.000Z',
  ...over,
});

const montar = async (repo: Repositorio = new RepositorioMemoria()) => {
  const vista = renderHook(() => useAlmacen(repo));
  await waitFor(() => expect(vista.result.current.cargando).toBe(false));
  return vista;
};

describe('useAlmacen', () => {
  it('loads what storage already holds', async () => {
    const repo = new RepositorioMemoria({ transacciones: [tx()] });

    const { result } = await montar(repo);

    expect(result.current.datos.transacciones).toHaveLength(1);
  });

  it('persists a new transaction', async () => {
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.agregarTransaccion(tx({ id: 'nueva' }));
    });

    expect(result.current.datos.transacciones.map((t) => t.id)).toEqual(['nueva']);
    // The point of the whole layer: it survives a fresh read.
    expect((await repo.cargarTodo()).transacciones).toHaveLength(1);
  });

  it('updates a transaction in place', async () => {
    const repo = new RepositorioMemoria({ transacciones: [tx()] });
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.actualizarTransaccion(tx({ amountCop: 45000 }));
    });

    expect(result.current.datos.transacciones).toHaveLength(1);
    expect((await repo.cargarTodo()).transacciones[0].amountCop).toBe(45000);
  });

  it('deletes a transaction', async () => {
    const repo = new RepositorioMemoria({ transacciones: [tx()] });
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.borrarTransaccion('tx-1');
    });

    expect((await repo.cargarTodo()).transacciones).toEqual([]);
  });

  it('records the delta needed to reach a stated pocket balance', async () => {
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.crearCajita({ nombre: 'Vacaciones', icon: '🏖️', tipo: 'cajita', metaCop: null, tasaEaPct: null, saldoInicialCop: 0 });
    });
    const cajitaId = result.current.datos.cajitas[0].id;

    await act(async () => {
      await result.current.registrarMovimiento({ cajitaId, kind: 'deposito', deltaCop: 100000 });
    });
    // "I actually have 175.000 in there."
    await act(async () => {
      await result.current.fijarSaldo(cajitaId, 175000);
    });

    const { cajitaMovimientos } = await repo.cargarTodo();
    expect(saldoDeCajita(cajitaMovimientos, cajitaId)).toBe(175000);
    const ajuste = cajitaMovimientos.find((m) => m.kind === 'ajuste');
    expect(ajuste?.deltaCop).toBe(75000);
  });

  it('records nothing when the stated balance is what it already was', async () => {
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.crearCajita({ nombre: 'Carro', icon: '🚗', tipo: 'cajita', metaCop: null, tasaEaPct: null, saldoInicialCop: 0 });
    });
    const cajitaId = result.current.datos.cajitas[0].id;
    await act(async () => {
      await result.current.registrarMovimiento({ cajitaId, kind: 'deposito', deltaCop: 50000 });
    });

    await act(async () => {
      await result.current.fijarSaldo(cajitaId, 50000);
    });

    // A zero-delta row would be history saying nothing happened.
    expect(result.current.datos.cajitaMovimientos).toHaveLength(1);
  });

  it('deleting a pocket drops its movements and unlinks its goal', async () => {
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.crearCajita({ nombre: 'Viaje', icon: '✈️', tipo: 'cajita', metaCop: null, tasaEaPct: null, saldoInicialCop: 0 });
    });
    const cajitaId = result.current.datos.cajitas[0].id;
    await act(async () => {
      await result.current.registrarMovimiento({ cajitaId, kind: 'deposito', deltaCop: 10000 });
      await result.current.crearMeta({
        nombre: 'Cartagena',
        icon: '🏖️',
        objetivoCop: 500000,
        fechaObjetivo: null,
        cajitaId,
        ahorradoCop: 0,
      });
    });

    await act(async () => {
      await result.current.borrarCajita(cajitaId);
    });

    expect(result.current.datos.cajitas).toEqual([]);
    expect(result.current.datos.cajitaMovimientos).toEqual([]);
    expect(result.current.datos.metas).toHaveLength(1);
    expect(result.current.datos.metas[0].cajitaId).toBeNull();
  });

  it('rolls back and reports when a write fails', async () => {
    const repo = new RepositorioMemoria({ transacciones: [tx()] });
    vi.spyOn(repo, 'guardarTransacciones').mockRejectedValue(new Error('disco lleno'));

    const { result } = await montar(repo);

    await act(async () => {
      await result.current.agregarTransaccion(tx({ id: 'fantasma' }));
    });

    expect(result.current.error).toBe('disco lleno');
    // The unsaved row must not linger on screen looking saved.
    expect(result.current.datos.transacciones.map((t) => t.id)).toEqual(['tx-1']);
  });

  it('reports storage that will not open, without dying', async () => {
    const repo = new RepositorioMemoria();
    vi.spyOn(repo, 'cargarTodo').mockRejectedValue(new Error('IndexedDB bloqueado'));

    const { result } = renderHook(() => useAlmacen(repo));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.error).toBe('IndexedDB bloqueado');
    expect(result.current.persistente).toBe(false);
  });

  it('records an opening balance as the first movement', async () => {
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.crearCajita({
        nombre: 'MacBook',
        icon: 'Laptop',
        tipo: 'cajita',
        metaCop: null,
        tasaEaPct: 13,
        saldoInicialCop: 1_031_199,
      });
    });

    const { cajitas, cajitaMovimientos } = await repo.cargarTodo();
    // Not a stored field: the balance is the sum of movements, and the yield
    // calculation needs a dated movement to know since when it has been earning.
    expect(cajitaMovimientos).toHaveLength(1);
    expect(cajitaMovimientos[0]).toMatchObject({ kind: 'deposito', deltaCop: 1_031_199 });
    expect(saldoDeCajita(cajitaMovimientos, cajitas[0].id)).toBe(1_031_199);
  });

  it('creates no movement when the pocket starts empty', async () => {
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.crearCajita({
        nombre: 'Vacía',
        icon: 'PiggyBank',
        tipo: 'cajita',
        metaCop: null,
        tasaEaPct: null,
        saldoInicialCop: 0,
      });
    });

    expect((await repo.cargarTodo()).cajitaMovimientos).toEqual([]);
  });
});
