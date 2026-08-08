import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento, Meta } from './modelos';
import type { Repositorio } from './repositorio';
import { RepositorioMemoria } from './repositorio';
import { RepositorioIndexedDB } from './indexeddb';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  kind: 'gasto',
  amountCop: 20000,
  category: 'comida',
  description: 'Almuerzo',
  occurredOn: '2026-08-06',
  cuentaId: null,
  rawTranscript: 'gasté 20 mil en el almuerzo',
  createdAt: '2026-08-06T12:00:00.000Z',
  ...over,
});

const cajita = (over: Partial<Cajita> = {}): Cajita => ({
  id: 'caj-1',
  nombre: 'Vacaciones',
  icon: '🏖️',
  tipo: 'cajita',
  metaCop: 2000000,
  tasaEaPct: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

const movimiento = (over: Partial<CajitaMovimiento> = {}): CajitaMovimiento => ({
  id: 'mov-1',
  cajitaId: 'caj-1',
  kind: 'deposito',
  deltaCop: 100000,
  categoria: null,
  occurredOn: '2026-08-02',
  nota: '',
  createdAt: '2026-08-02T00:00:00.000Z',
  ...over,
});

const meta = (over: Partial<Meta> = {}): Meta => ({
  id: 'meta-1',
  nombre: 'Viaje a Cartagena',
  icon: '✈️',
  objetivoCop: 3000000,
  fechaObjetivo: '2026-12-31',
  cajitaId: null,
  ahorradoCop: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  completedAt: null,
  ...over,
});

/**
 * Both implementations are held to one contract. Divergence between them is the
 * failure mode that matters: the in-memory one is what the tests exercise and
 * what runs when IndexedDB is unavailable, so any behaviour that is only true of
 * one of them is a bug waiting for a private-window user to find.
 */
const contrato = (nombre: string, crear: () => Repositorio) => {
  describe(nombre, () => {
    let repo: Repositorio;

    beforeEach(async () => {
      repo = crear();
      await repo.vaciar();
    });

    it('starts empty', async () => {
      const datos = await repo.cargarTodo();

      expect(datos.transacciones).toEqual([]);
      expect(datos.cajitas).toEqual([]);
      expect(datos.cajitaMovimientos).toEqual([]);
      expect(datos.metas).toEqual([]);
    });

    it('round-trips a transaction', async () => {
      await repo.guardarTransacciones([tx()]);

      const { transacciones } = await repo.cargarTodo();
      expect(transacciones).toHaveLength(1);
      expect(transacciones[0]).toMatchObject({ id: 'tx-1', amountCop: 20000 });
    });

    it('updates rather than duplicates on the same id', async () => {
      await repo.guardarTransacciones([tx()]);
      await repo.guardarTransacciones([tx({ amountCop: 35000, description: 'Cena' })]);

      const { transacciones } = await repo.cargarTodo();
      expect(transacciones).toHaveLength(1);
      expect(transacciones[0]).toMatchObject({ amountCop: 35000, description: 'Cena' });
    });

    it('writes a batch in one call', async () => {
      await repo.guardarTransacciones([tx({ id: 'a' }), tx({ id: 'b' }), tx({ id: 'c' })]);

      const { transacciones } = await repo.cargarTodo();
      expect(transacciones.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
    });

    it('tolerates an empty batch', async () => {
      await expect(repo.guardarTransacciones([])).resolves.toBeUndefined();
    });

    it('deletes a transaction', async () => {
      await repo.guardarTransacciones([tx({ id: 'a' }), tx({ id: 'b' })]);

      await repo.borrarTransaccion('a');

      const { transacciones } = await repo.cargarTodo();
      expect(transacciones.map((t) => t.id)).toEqual(['b']);
    });

    it('round-trips pockets and their movements', async () => {
      await repo.guardarCajita(cajita());
      await repo.guardarCajitaMovimientos([movimiento(), movimiento({ id: 'mov-2' })]);

      const datos = await repo.cargarTodo();
      expect(datos.cajitas).toHaveLength(1);
      expect(datos.cajitaMovimientos).toHaveLength(2);
    });

    it('deleting a pocket takes its movements with it', async () => {
      await repo.guardarCajita(cajita());
      await repo.guardarCajita(cajita({ id: 'caj-2', nombre: 'Carro' }));
      await repo.guardarCajitaMovimientos([
        movimiento({ id: 'mov-1', cajitaId: 'caj-1' }),
        movimiento({ id: 'mov-2', cajitaId: 'caj-1' }),
        movimiento({ id: 'mov-3', cajitaId: 'caj-2' }),
      ]);

      await repo.borrarCajita('caj-1');

      const datos = await repo.cargarTodo();
      expect(datos.cajitas.map((c) => c.id)).toEqual(['caj-2']);
      // The survivor's history must be untouched.
      expect(datos.cajitaMovimientos.map((m) => m.id)).toEqual(['mov-3']);
    });

    it('unlinks a goal when its pocket is deleted', async () => {
      await repo.guardarCajita(cajita());
      await repo.guardarMeta(meta({ cajitaId: 'caj-1' }));

      await repo.borrarCajita('caj-1');

      const { metas } = await repo.cargarTodo();
      // The goal survives — losing the pocket must not destroy the target the
      // user set, only the link that fed its progress.
      expect(metas).toHaveLength(1);
      expect(metas[0].cajitaId).toBeNull();
      expect(metas[0].objetivoCop).toBe(3000000);
    });

    it('round-trips a goal', async () => {
      await repo.guardarMeta(meta());

      const { metas } = await repo.cargarTodo();
      expect(metas[0]).toMatchObject({ nombre: 'Viaje a Cartagena', objetivoCop: 3000000 });
    });

    it('deletes a goal', async () => {
      await repo.guardarMeta(meta());

      await repo.borrarMeta('meta-1');

      expect((await repo.cargarTodo()).metas).toEqual([]);
    });

    it('empties every store', async () => {
      await repo.guardarTransacciones([tx()]);
      await repo.guardarCajita(cajita());
      await repo.guardarCajitaMovimientos([movimiento()]);
      await repo.guardarMeta(meta());

      await repo.vaciar();

      const datos = await repo.cargarTodo();
      expect(datos.transacciones).toEqual([]);
      expect(datos.cajitas).toEqual([]);
      expect(datos.cajitaMovimientos).toEqual([]);
      expect(datos.metas).toEqual([]);
    });

    it('does not hand out references into its own storage', async () => {
      await repo.guardarTransacciones([tx()]);

      const primera = await repo.cargarTodo();
      primera.transacciones[0].amountCop = 999999;

      const segunda = await repo.cargarTodo();
      expect(segunda.transacciones[0].amountCop).toBe(20000);
    });
  });
};

contrato('RepositorioMemoria', () => new RepositorioMemoria());

contrato('RepositorioIndexedDB', () => {
  // A fresh factory per instance: fake-indexeddb keeps databases on the global,
  // so without this every test would inherit the previous one's data.
  globalThis.indexedDB = new IDBFactory();
  return new RepositorioIndexedDB();
});
