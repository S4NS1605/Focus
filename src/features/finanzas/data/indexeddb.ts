import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento, Meta } from './modelos';
import type { CategoriaPersonal } from '../categorias';
import type { Contacto } from '../lib/contactos';
import type { Instantanea, Repositorio } from './repositorio';
import { instantaneaVacia } from './repositorio';

const DB_NOMBRE = 'finanzas';
// Bumped when a store is added: `onupgradeneeded` only fires on a version
// change, so a device that already opened the database at v1 would otherwise
// never get the new store.
const DB_VERSION = 3;

const STORES = {
  transacciones: 'transacciones',
  cajitas: 'cajitas',
  cajitaMovimientos: 'cajitaMovimientos',
  metas: 'metas',
  categorias: 'categorias',
  contactos: 'contactos',
} as const;

type StoreNombre = (typeof STORES)[keyof typeof STORES];

/** Promise wrapper for the event-based IDBRequest API. */
const pedir = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

/**
 * Resolves when the transaction COMMITS, not when the last request succeeds.
 * Those are different moments: a request can report success and the transaction
 * still abort (quota, a constraint elsewhere), which would otherwise be reported
 * to the user as a successful save that quietly did not happen.
 */
const completar = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });

export const soportaIndexedDB = (): boolean =>
  typeof indexedDB !== 'undefined' && indexedDB !== null;

const abrir = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NOMBRE, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const nombre of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(nombre)) {
          db.createObjectStore(nombre, { keyPath: 'id' });
        }
      }
      // Pocket history is always read one pocket at a time; without this index
      // that read is a full scan of every movement ever recorded.
      const store = request.transaction?.objectStore(STORES.cajitaMovimientos);
      if (store && !store.indexNames.contains('porCajita')) {
        store.createIndex('porCajita', 'cajitaId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'));
    // Fires when another tab holds an older version open. Rather than hang
    // forever waiting for a tab the user may not even remember, fail loudly.
    request.onblocked = () =>
      reject(new Error('Otra pestaña tiene la base de datos abierta. Ciérrala y recarga.'));
  });

export class RepositorioIndexedDB implements Repositorio {
  private db: IDBDatabase | null = null;

  private async conexion(): Promise<IDBDatabase> {
    if (!this.db) this.db = await abrir();
    return this.db;
  }

  private async escribir(
    stores: StoreNombre[],
    trabajo: (tx: IDBTransaction) => void,
  ): Promise<void> {
    const db = await this.conexion();
    const tx = db.transaction(stores, 'readwrite');
    trabajo(tx);
    await completar(tx);
  }

  async cargarTodo(): Promise<Instantanea> {
    const db = await this.conexion();
    const tx = db.transaction(Object.values(STORES), 'readonly');

    // Issued together on one transaction so every list is read from the same
    // consistent point, then awaited.
    const [transacciones, cajitas, cajitaMovimientos, metas, categorias, contactos] = await Promise.all([
      pedir<Transaction[]>(tx.objectStore(STORES.transacciones).getAll()),
      pedir<Cajita[]>(tx.objectStore(STORES.cajitas).getAll()),
      pedir<CajitaMovimiento[]>(tx.objectStore(STORES.cajitaMovimientos).getAll()),
      pedir<Meta[]>(tx.objectStore(STORES.metas).getAll()),
      pedir<CategoriaPersonal[]>(tx.objectStore(STORES.categorias).getAll()),
      pedir<Contacto[]>(tx.objectStore(STORES.contactos).getAll()),
    ]);

    return { transacciones, cajitas, cajitaMovimientos, metas, categorias, contactos };
  }

  async guardarTransacciones(transacciones: readonly Transaction[]): Promise<void> {
    if (transacciones.length === 0) return;
    await this.escribir([STORES.transacciones], (tx) => {
      const store = tx.objectStore(STORES.transacciones);
      for (const t of transacciones) store.put(t);
    });
  }

  async borrarTransaccion(id: string): Promise<void> {
    await this.escribir([STORES.transacciones], (tx) => {
      tx.objectStore(STORES.transacciones).delete(id);
    });
  }

  async guardarCajita(cajita: Cajita): Promise<void> {
    await this.escribir([STORES.cajitas], (tx) => {
      tx.objectStore(STORES.cajitas).put(cajita);
    });
  }

  async borrarCajita(id: string): Promise<void> {
    // All three stores join one transaction: a pocket that vanished while its
    // movements survived would resurrect as a phantom balance on next load.
    await this.escribir(
      [STORES.cajitas, STORES.cajitaMovimientos, STORES.metas],
      (tx) => {
        tx.objectStore(STORES.cajitas).delete(id);

        const movimientos = tx.objectStore(STORES.cajitaMovimientos);
        const cursor = movimientos.index('porCajita').openCursor(IDBKeyRange.only(id));
        cursor.onsuccess = () => {
          const actual = cursor.result;
          if (!actual) return;
          actual.delete();
          actual.continue();
        };

        const metas = tx.objectStore(STORES.metas);
        metas.getAll().onsuccess = function () {
          for (const meta of this.result as Meta[]) {
            if (meta.cajitaId === id) metas.put({ ...meta, cajitaId: null });
          }
        };
      },
    );
  }

  async guardarCajitaMovimientos(movimientos: readonly CajitaMovimiento[]): Promise<void> {
    if (movimientos.length === 0) return;
    await this.escribir([STORES.cajitaMovimientos], (tx) => {
      const store = tx.objectStore(STORES.cajitaMovimientos);
      for (const m of movimientos) store.put(m);
    });
  }

  async borrarCajitaMovimiento(id: string): Promise<void> {
    await this.escribir([STORES.cajitaMovimientos], (tx) => {
      tx.objectStore(STORES.cajitaMovimientos).delete(id);
    });
  }

  async guardarMeta(meta: Meta): Promise<void> {
    await this.escribir([STORES.metas], (tx) => {
      tx.objectStore(STORES.metas).put(meta);
    });
  }

  async borrarMeta(id: string): Promise<void> {
    await this.escribir([STORES.metas], (tx) => {
      tx.objectStore(STORES.metas).delete(id);
    });
  }

  async guardarCategoria(categoria: CategoriaPersonal): Promise<void> {
    await this.escribir([STORES.categorias], (tx) => {
      tx.objectStore(STORES.categorias).put(categoria);
    });
  }

  async guardarContacto(contacto: Contacto): Promise<void> {
    await this.escribir([STORES.contactos], (tx) => {
      tx.objectStore(STORES.contactos).put(contacto);
    });
  }

  async borrarContacto(id: string): Promise<void> {
    await this.escribir([STORES.contactos], (tx) => {
      tx.objectStore(STORES.contactos).delete(id);
    });
  }

  async borrarCategoria(id: string): Promise<void> {
    // Movements keep their category key — see RepositorioMemoria.
    await this.escribir([STORES.categorias], (tx) => {
      tx.objectStore(STORES.categorias).delete(id);
    });
  }

  async vaciar(): Promise<void> {
    await this.escribir(Object.values(STORES) as StoreNombre[], (tx) => {
      for (const nombre of Object.values(STORES)) tx.objectStore(nombre).clear();
    });
  }
}

/** The empty snapshot, for callers that need a shape before storage answers. */
export const sinDatos = instantaneaVacia;
