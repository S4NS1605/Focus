import { abrirBase } from './indexeddb';
import type { Repositorio } from './repositorio';

/** Cualquier método de escritura del repositorio. `cargarTodo` no cuenta: no
 *  hay nada que reintentar cuando lo que falló fue solo leer. */
export type MetodoDeEscritura = Exclude<keyof Repositorio, 'cargarTodo'>;

/** Un cambio a la espera de subirse, tal como salió de la cola. */
export interface CambioPendiente {
  /** La clave que le puso IndexedDB. Sirve para borrarlo cuando ya subió. */
  clave: IDBValidKey;
  metodo: MetodoDeEscritura;
  args: unknown[];
}

const TIENDA = 'colaPendiente';

/**
 * Los cambios que se hicieron sin conexión, guardados en el orden en que
 * pasaron, a la espera de que vuelva la señal para subirlos.
 *
 * Vive en la MISMA base de datos que el caché al que pertenece (mismo nombre,
 * pasado por quien la crea) — nunca en una base aparte. Así un cambio
 * pendiente de la cuenta de una persona jamás puede terminar guardado en el
 * caché de otra: los dos viven o mueren juntos, con el mismo nombre de base
 * que ya los separa por usuario.
 */
export class ColaCambios {
  private db: IDBDatabase | null = null;
  private readonly nombreDeBase: string;

  constructor(nombreDeBase: string) {
    this.nombreDeBase = nombreDeBase;
  }

  private async conexion(): Promise<IDBDatabase> {
    if (!this.db) this.db = await abrirBase(this.nombreDeBase);
    return this.db;
  }

  /** Añade un cambio al final de la cola. */
  async encolar(metodo: MetodoDeEscritura, args: unknown[]): Promise<void> {
    const db = await this.conexion();
    const tx = db.transaction(TIENDA, 'readwrite');
    tx.objectStore(TIENDA).add({ metodo, args });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('No se pudo guardar el cambio pendiente.'));
    });
  }

  /**
   * Todo lo que hay en la cola, en el orden en que se guardó.
   *
   * El orden lo da la clave autoincremental de IndexedDB, que `getAll()`
   * devuelve siempre ascendente — es justo lo que hace que reintentar los
   * cambios en este orden reproduzca lo que la persona hizo de verdad.
   */
  async listar(): Promise<CambioPendiente[]> {
    const db = await this.conexion();
    const tx = db.transaction(TIENDA, 'readonly');
    const store = tx.objectStore(TIENDA);
    const [claves, valores] = await Promise.all([
      new Promise<IDBValidKey[]>((res, rej) => {
        const r = store.getAllKeys();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      }),
      new Promise<{ metodo: MetodoDeEscritura; args: unknown[] }[]>((res, rej) => {
        const r = store.getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      }),
    ]);
    return claves.map((clave, i) => ({ clave, ...valores[i] }));
  }

  /** Se llama cuando un cambio de la cola ya se subió con éxito. */
  async quitar(clave: IDBValidKey): Promise<void> {
    const db = await this.conexion();
    const tx = db.transaction(TIENDA, 'readwrite');
    tx.objectStore(TIENDA).delete(clave);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('No se pudo actualizar la cola.'));
    });
  }

  /** Cuántos cambios están esperando subir. Para mostrarlo en pantalla. */
  async contar(): Promise<number> {
    const db = await this.conexion();
    const tx = db.transaction(TIENDA, 'readonly');
    return new Promise((resolve, reject) => {
      const r = tx.objectStore(TIENDA).count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
}
