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
  cuentaId: null,
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
    const cajitaId = result.current.datos.cajitas.find((c) => c.nombre === 'Vacaciones')!.id;

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
    const cajitaId = result.current.datos.cajitas.find((c) => c.nombre === 'Carro')!.id;
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
    const cajitaId = result.current.datos.cajitas.find((c) => c.nombre === 'Viaje')!.id;
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

    expect(result.current.datos.cajitas.map((c) => c.nombre)).not.toContain('Viaje');
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
    const macbook = cajitas.find((c) => c.nombre === 'MacBook')!;
    expect(saldoDeCajita(cajitaMovimientos, macbook.id)).toBe(1_031_199);
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

  it('seeds a cash account, and only ever one', async () => {
    const repo = new RepositorioMemoria();
    const { result, unmount } = await montar(repo);

    expect(result.current.datos.cajitas.map((c) => c.nombre)).toEqual(['Efectivo']);
    unmount();

    // A second session must not add a second one.
    const otra = await montar(repo);
    expect(otra.result.current.datos.cajitas.filter((c) => c.nombre === 'Efectivo')).toHaveLength(1);
  });

  it('does not resurrect the cash account once it has been archived', async () => {
    // Seeding is a default, not a rule. Someone who never handles cash should be
    // able to put it away and have it stay away.
    const repo = new RepositorioMemoria({
      cajitas: [
        {
          id: 'efectivo',
          nombre: 'Efectivo',
          icon: 'Wallet',
          tipo: 'cuenta',
          metaCop: null,
          tasaEaPct: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          archivedAt: '2026-08-02T00:00:00.000Z',
        },
      ],
    });

    const { result } = await montar(repo);

    expect(result.current.datos.cajitas).toHaveLength(1);
    expect(result.current.datos.cajitas[0].archivedAt).not.toBeNull();
  });

  it('paying a debt moves the debt AND the account it came from', async () => {
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    // Un `act` por creación: cada acción parte del estado del render actual, así
    // que dos seguidas dentro del mismo acto harían que la segunda pisara a la
    // primera.
    await act(async () => {
      await result.current.crearCajita({
        nombre: 'Credito NU', icon: 'CreditCard', tipo: 'tarjeta',
        metaCop: null, tasaEaPct: null, saldoInicialCop: 200_000,
      });
    });
    await act(async () => {
      await result.current.crearCajita({
        nombre: 'Nequi', icon: 'Wallet', tipo: 'cuenta',
        metaCop: null, tasaEaPct: null, saldoInicialCop: 500_000,
      });
    });

    const idDe = (nombre: string) =>
      result.current.datos.cajitas.find((c) => c.nombre === nombre)!.id;
    const deudaId = idDe('Credito NU');
    const cuentaId = idDe('Nequi');

    await act(async () => {
      await result.current.abonarDeuda({ deudaId, cuentaId, montoCop: 30_000 });
    });

    const movs = result.current.datos.cajitaMovimientos;
    expect(saldoDeCajita(movs, deudaId)).toBe(170_000);
    expect(saldoDeCajita(movs, cuentaId)).toBe(470_000);
  });

  it('records a debt payment as a transfer, never as a month\'s expense', async () => {
    // Paying a card is not new consumption: the money was already counted when
    // it was spent. Booking it as a gasto would inflate every month a card gets
    // paid off.
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.crearCajita({
        nombre: 'Visa', icon: 'CreditCard', tipo: 'tarjeta',
        metaCop: null, tasaEaPct: null, saldoInicialCop: 100_000,
      });
    });
    const deudaId = result.current.datos.cajitas.find((c) => c.nombre === 'Visa')!.id;
    const cuentaId = result.current.datos.cajitas.find((c) => c.nombre === 'Efectivo')!.id;

    await act(async () => {
      await result.current.abonarDeuda({ deudaId, cuentaId, montoCop: 40_000 });
    });

    expect(result.current.datos.transacciones).toEqual([]);
  });

  it('unir dos grafías las deja bajo un solo contacto', async () => {
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.unirContactos('JUAN PEREZ', 'Juan Carlos Perez', 'Juan Perez');
    });

    const { contactos } = result.current.datos;
    expect(contactos).toHaveLength(1);
    expect(contactos[0].alias.sort()).toEqual(['juan carlos perez', 'juan perez']);
    expect(contactos[0].nombre).toBe('Juan Perez');
  });

  it('unir dos veces no crea un contacto de más', async () => {
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.unirContactos('Juan Perez', 'Juan Carlos Perez', 'Juan Perez');
    });
    await act(async () => {
      await result.current.unirContactos('Juan Perez', 'Juan P', 'Juan Perez');
    });

    const { contactos } = result.current.datos;
    expect(contactos).toHaveLength(1);
    expect(contactos[0].alias.sort()).toEqual(['juan carlos perez', 'juan p', 'juan perez']);
  });

  it('separar guarda el nombre que se muestra, no la clave normalizada', async () => {
    // La clave es columna de unión. Mostrarla convierte "Juan Carlos Perez" en
    // "juan carlos perez" en pantalla.
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.separarContactos('juan perez', 'juan gomez', 'Juan Perez');
    });

    expect(result.current.datos.contactos[0].nombre).toBe('Juan Perez');
    expect(result.current.datos.contactos[0].separadoDe).toEqual(['juan gomez']);
  });

  it('unir después de haber separado quita el rechazo', async () => {
    // Cambiar de opinión tiene que poder deshacerse, o el "no" de un descuido
    // deja a esas dos grafías separadas para siempre.
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.separarContactos('juan perez', 'juan carlos perez', 'Juan Perez');
    });
    await act(async () => {
      await result.current.unirContactos('juan perez', 'juan carlos perez', 'Juan Perez');
    });

    const contacto = result.current.datos.contactos[0];
    expect(contacto.separadoDe).not.toContain('juan carlos perez');
    expect(contacto.alias.sort()).toEqual(['juan carlos perez', 'juan perez']);
  });

  it('no une un nombre consigo mismo', async () => {
    const repo = new RepositorioMemoria();
    const { result } = await montar(repo);

    await act(async () => {
      await result.current.unirContactos('Juan Pérez', 'JUAN PEREZ', 'Juan Perez');
    });

    expect(result.current.datos.contactos).toEqual([]);
  });
});
