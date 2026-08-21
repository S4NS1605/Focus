import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento, Meta } from './modelos';
import type { CategoriaPersonal } from '../categorias';
import type { Contacto } from '../lib/contactos';
import type { Presupuesto } from '../lib/presupuestos';
import type { Recurrente } from '../lib/recurrentes';

/**
 * Everything the app is allowed to know about storage.
 *
 * Async throughout even though the local implementation could answer
 * synchronously: the whole point of this seam is that a remote backend can drop
 * in without touching a single call site, and a sync interface would make that a
 * rewrite. The cost is one `await` per call today.
 *
 * Writes take whole records rather than patches. Reconciling partial updates is
 * the one thing a two-writer setup (this device plus a server) gets wrong most
 * easily, and full records keep that decision in one place later.
 */
export interface Repositorio {
  cargarTodo(): Promise<Instantanea>;

  guardarTransacciones(transacciones: readonly Transaction[]): Promise<void>;
  borrarTransaccion(id: string): Promise<void>;

  guardarCajita(cajita: Cajita): Promise<void>;
  borrarCajita(id: string): Promise<void>;

  guardarCajitaMovimientos(movimientos: readonly CajitaMovimiento[]): Promise<void>;
  borrarCajitaMovimiento(id: string): Promise<void>;

  guardarMeta(meta: Meta): Promise<void>;
  borrarMeta(id: string): Promise<void>;

  guardarCategoria(categoria: CategoriaPersonal): Promise<void>;
  borrarCategoria(id: string): Promise<void>;

  guardarContacto(contacto: Contacto): Promise<void>;
  borrarContacto(id: string): Promise<void>;

  /** Uno por categoría: guardar el mismo dos veces reemplaza, no duplica. */
  guardarPresupuesto(presupuesto: Presupuesto): Promise<void>;
  borrarPresupuesto(categoria: string): Promise<void>;

  guardarRecurrente(recurrente: Recurrente): Promise<void>;
  borrarRecurrente(id: string): Promise<void>;

  /** Wipes every store. Used by the restore flow before importing a backup. */
  vaciar(): Promise<void>;
}

/** One read of everything. The dataset is a personal ledger — it fits in memory. */
export interface Instantanea {
  transacciones: Transaction[];
  cajitas: Cajita[];
  cajitaMovimientos: CajitaMovimiento[];
  metas: Meta[];
  categorias: CategoriaPersonal[];
  contactos: Contacto[];
  presupuestos: Presupuesto[];
  recurrentes: Recurrente[];
}

export const instantaneaVacia = (): Instantanea => ({
  transacciones: [],
  cajitas: [],
  cajitaMovimientos: [],
  metas: [],
  categorias: [],
  contactos: [],
  presupuestos: [],
  recurrentes: [],
});

/**
 * In-memory storage. Used by tests, and as the fallback when IndexedDB is
 * unavailable (Firefox in private mode refuses to open a database at all) — the
 * app stays usable for the session instead of failing to start.
 */
export class RepositorioMemoria implements Repositorio {
  private datos: Instantanea = instantaneaVacia();

  constructor(inicial?: Partial<Instantanea>) {
    this.datos = { ...instantaneaVacia(), ...inicial };
  }

  async cargarTodo(): Promise<Instantanea> {
    // Deep-copied on the way out, not merely a fresh array: IndexedDB returns
    // structured clones, so a caller that mutates what it received can never
    // reach back into that store. A shallow copy here would leave the two
    // implementations subtly different — every record would still be shared.
    // All four record types are flat, so one spread per item is a full copy.
    return {
      transacciones: this.datos.transacciones.map((t) => ({ ...t })),
      cajitas: this.datos.cajitas.map((c) => ({ ...c })),
      cajitaMovimientos: this.datos.cajitaMovimientos.map((m) => ({ ...m })),
      metas: this.datos.metas.map((m) => ({ ...m })),
      categorias: this.datos.categorias.map((c) => ({ ...c })),
      // Arrays inside are copied too: a shallow spread would share `alias`
      // between the store and its reader.
      presupuestos: this.datos.presupuestos.map((p) => ({ ...p })),
      recurrentes: this.datos.recurrentes.map((r) => ({ ...r })),
      contactos: this.datos.contactos.map((c) => ({
        ...c,
        alias: [...c.alias],
        separadoDe: [...c.separadoDe],
        apodos: [...c.apodos],
      })),
    };
  }

  private upsert<T extends { id: string }>(lista: T[], entradas: readonly T[]): T[] {
    const porId = new Map(lista.map((item) => [item.id, item]));
    for (const entrada of entradas) porId.set(entrada.id, { ...entrada });
    return [...porId.values()];
  }

  async guardarTransacciones(transacciones: readonly Transaction[]): Promise<void> {
    this.datos.transacciones = this.upsert(this.datos.transacciones, transacciones);
  }

  async borrarTransaccion(id: string): Promise<void> {
    this.datos.transacciones = this.datos.transacciones.filter((t) => t.id !== id);
  }

  async guardarCajita(cajita: Cajita): Promise<void> {
    this.datos.cajitas = this.upsert(this.datos.cajitas, [cajita]);
  }

  async borrarCajita(id: string): Promise<void> {
    this.datos.cajitas = this.datos.cajitas.filter((c) => c.id !== id);
    // Movements outlive nothing: a pocket's history is meaningless without it,
    // and leaving them behind would silently skew any later balance rebuild.
    this.datos.cajitaMovimientos = this.datos.cajitaMovimientos.filter((m) => m.cajitaId !== id);
    this.datos.metas = this.datos.metas.map((meta) =>
      meta.cajitaId === id ? { ...meta, cajitaId: null } : meta,
    );
  }

  async guardarCajitaMovimientos(movimientos: readonly CajitaMovimiento[]): Promise<void> {
    this.datos.cajitaMovimientos = this.upsert(this.datos.cajitaMovimientos, movimientos);
  }

  async borrarCajitaMovimiento(id: string): Promise<void> {
    this.datos.cajitaMovimientos = this.datos.cajitaMovimientos.filter((m) => m.id !== id);
  }

  async guardarMeta(meta: Meta): Promise<void> {
    this.datos.metas = this.upsert(this.datos.metas, [meta]);
  }

  async borrarMeta(id: string): Promise<void> {
    this.datos.metas = this.datos.metas.filter((m) => m.id !== id);
  }

  async guardarCategoria(categoria: CategoriaPersonal): Promise<void> {
    this.datos.categorias = this.upsert(this.datos.categorias, [categoria]);
  }

  async guardarContacto(contacto: Contacto): Promise<void> {
    this.datos.contactos = this.upsert(this.datos.contactos, [contacto]);
  }

  async borrarContacto(id: string): Promise<void> {
    this.datos.contactos = this.datos.contactos.filter((c) => c.id !== id);
  }

  async guardarPresupuesto(presupuesto: Presupuesto): Promise<void> {
    // Se reemplaza por categoría, no se acumula: dos filas para la misma
    // categoría serían dos topes distintos para el mismo gasto.
    this.datos.presupuestos = [
      ...this.datos.presupuestos.filter((p) => p.categoria !== presupuesto.categoria),
      { ...presupuesto },
    ];
  }

  async borrarPresupuesto(categoria: string): Promise<void> {
    this.datos.presupuestos = this.datos.presupuestos.filter((p) => p.categoria !== categoria);
  }

  async guardarRecurrente(recurrente: Recurrente): Promise<void> {
    this.datos.recurrentes = this.upsert(this.datos.recurrentes, [recurrente]);
  }

  async borrarRecurrente(id: string): Promise<void> {
    this.datos.recurrentes = this.datos.recurrentes.filter((r) => r.id !== id);
  }

  async borrarCategoria(id: string): Promise<void> {
    // Unlike a pocket, the movements filed here are NOT removed. Their category
    // key stays exactly as it was — deleting a category is a decision about the
    // picker, never a decision to rewrite what already happened.
    this.datos.categorias = this.datos.categorias.filter((c) => c.id !== id);
  }

  async vaciar(): Promise<void> {
    this.datos = instantaneaVacia();
  }
}
