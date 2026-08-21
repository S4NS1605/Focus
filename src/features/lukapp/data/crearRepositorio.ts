import type { Repositorio } from './repositorio';
import { RepositorioMemoria } from './repositorio';
import { RepositorioIndexedDB, soportaIndexedDB } from './indexeddb';

/**
 * Picks the best storage this browser can actually provide.
 *
 * Falling back to memory rather than failing is deliberate: Firefox in private
 * mode refuses to open a database at all, and an app that will not start is
 * worse than one that warns it cannot remember this session. Callers surface
 * `persistente` so the UI can say so plainly instead of silently losing data.
 */
export interface RepositorioElegido {
  repositorio: Repositorio;
  persistente: boolean;
}

export const crearRepositorio = (): RepositorioElegido =>
  soportaIndexedDB()
    ? { repositorio: new RepositorioIndexedDB(), persistente: true }
    : { repositorio: new RepositorioMemoria(), persistente: false };
