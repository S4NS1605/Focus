import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento, Meta } from './modelos';
import type { CategoriaPersonal } from '../categorias';
import type { Contacto } from '../lib/contactos';
import type { Presupuesto } from '../lib/presupuestos';
import type { Recurrente } from '../lib/recurrentes';
import type { Instantanea, Repositorio } from './repositorio';
import { ColaCambios } from './colaCambios';
import type { MetodoDeEscritura } from './colaCambios';

/**
 * Si esto es lo que falló, es que no hay señal — no que el dato esté mal.
 *
 * Un fallo de constraint o de permiso llega en el campo `error` de la
 * respuesta de Supabase y `RepositorioSupabase.fallar` ya lo convierte en un
 * mensaje claro (`Error('El monto debe ser mayor que cero.')`, etc.). Un
 * fallo de RED, en cambio, hace que la propia promesa del `fetch` se
 * rechace ANTES de que exista una respuesta que interpretar — eso es lo que
 * distingue las dos cosas.
 */
const esErrorDeRed = (e: unknown): boolean => {
  if (e instanceof TypeError) return true; // "Failed to fetch" en todos los navegadores
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    return m.includes('failed to fetch') || m.includes('network') || m.includes('load failed');
  }
  return false;
};

/**
 * Guarda sin conexión y sube solo cuando vuelve la señal.
 *
 * Cada escritura se hace primero en `local` (siempre funciona, no necesita
 * internet) y luego se intenta en `remoto`. Si `remoto` falla por falta de
 * señal, el cambio se anota en `cola` en vez de perderse, y queda ahí hasta
 * que algo vuelva a pedir sincronizar.
 *
 * Las lecturas (`cargarTodo`) prefieren `remoto` cuando hay señal y la cola
 * está vacía — así se ve siempre el dato más fresco, incluido lo que otro
 * aparato haya escrito. Con la cola pendiente, leer de `remoto` sería mostrar
 * una versión que todavía no conoce tus propios cambios, así que en ese caso
 * se lee de `local`, que sí los tiene.
 */
/**
 * Lo que `RepositorioConCola` ofrece de más, por encima de `Repositorio`.
 *
 * Ningún otro repositorio (memoria, IndexedDB a secas, Supabase a secas) lo
 * implementa — solo tiene sentido cuando hay dos capas y una cola entre ellas.
 * `useAlmacen` comprueba con `tieneSincronizacion` antes de usarlo, así que
 * sigue funcionando igual con cualquier otro repositorio.
 */
export interface RepositorioConSincronizacion {
  cambiosPendientes(): Promise<number>;
  sincronizar(): Promise<void>;
}

export const tieneSincronizacion = (
  repo: Repositorio,
): repo is Repositorio & RepositorioConSincronizacion =>
  typeof (repo as Partial<RepositorioConSincronizacion>).cambiosPendientes === 'function';

export class RepositorioConCola implements Repositorio {
  private readonly local: Repositorio;
  private readonly remoto: Repositorio;
  private readonly cola: ColaCambios;

  constructor(local: Repositorio, remoto: Repositorio, cola: ColaCambios) {
    this.local = local;
    this.remoto = remoto;
    this.cola = cola;
  }

  /** Cuántos cambios están esperando subir. Lo usa la app para avisarlo. */
  async cambiosPendientes(): Promise<number> {
    return this.cola.contar();
  }

  /**
   * Intenta subir todo lo que está en la cola, en el orden en que se guardó.
   *
   * Se detiene en el primer fallo y deja el resto tal como estaba: nunca
   * salta un cambio para intentar el siguiente. Editar y luego borrar el
   * mismo movimiento tiene que subir en ese orden — si el borrado llegara
   * primero, la edición de algo que ya no existe fallaría también, y en el
   * orden equivocado.
   *
   * Un fallo que NO es de red (por ejemplo la sesión venció) también detiene
   * la cola en vez de descartar el cambio: en una app de plata, perder en
   * silencio algo que la persona sí guardó es peor que dejarlo pendiente un
   * rato más largo de lo normal.
   */
  async sincronizar(): Promise<void> {
    if (!navigator.onLine) return;
    for (const cambio of await this.cola.listar()) {
      try {
        await this.llamarRemoto(cambio.metodo, cambio.args);
        await this.cola.quitar(cambio.clave);
      } catch {
        return;
      }
    }
  }

  async cargarTodo(): Promise<Instantanea> {
    if (navigator.onLine) {
      await this.sincronizar();
      if ((await this.cola.contar()) === 0) {
        try {
          const fresco = await this.remoto.cargarTodo();
          await this.espejarEnLocal(fresco);
          return fresco;
        } catch (e) {
          if (!esErrorDeRed(e)) throw e;
          // Fallo de red pese a que `navigator.onLine` decía que sí había:
          // pasa con redes capturas de portal cautivo o inestables. Se sigue
          // con el caché de abajo en vez de dejar la pantalla en blanco.
        }
      }
    }
    return this.local.cargarTodo();
  }

  /** Copia todo lo del servidor al caché local, para que quede si se cae la señal. */
  private async espejarEnLocal(datos: Instantanea): Promise<void> {
    await this.local.vaciar();
    await Promise.all([
      this.local.guardarTransacciones(datos.transacciones),
      this.local.guardarCajitaMovimientos(datos.cajitaMovimientos),
      ...datos.cajitas.map((c) => this.local.guardarCajita(c)),
      ...datos.metas.map((m) => this.local.guardarMeta(m)),
      ...datos.categorias.map((c) => this.local.guardarCategoria(c)),
      ...datos.contactos.map((c) => this.local.guardarContacto(c)),
      ...datos.presupuestos.map((p) => this.local.guardarPresupuesto(p)),
      ...datos.recurrentes.map((r) => this.local.guardarRecurrente(r)),
    ]);
  }

  private async llamarRemoto(metodo: MetodoDeEscritura, args: unknown[]): Promise<void> {
    const fn = this.remoto[metodo] as (...a: unknown[]) => Promise<void>;
    await fn.apply(this.remoto, args);
  }

  private async llamarLocal(metodo: MetodoDeEscritura, args: unknown[]): Promise<void> {
    const fn = this.local[metodo] as (...a: unknown[]) => Promise<void>;
    await fn.apply(this.local, args);
  }

  /**
   * El corazón de esta clase. Escribe en `local` primero — eso nunca falla
   * por falta de señal — y solo entonces intenta `remoto`.
   *
   * Si ya hay algo en la cola, este cambio se pone detrás y ni se intenta
   * enviar todavía: mandarlo antes que lo que sigue esperando rompería el
   * orden en que la persona hizo las cosas.
   */
  private async escribir(metodo: MetodoDeEscritura, args: unknown[]): Promise<void> {
    await this.llamarLocal(metodo, args);

    if ((await this.cola.contar()) > 0) {
      await this.cola.encolar(metodo, args);
      return;
    }
    if (!navigator.onLine) {
      await this.cola.encolar(metodo, args);
      return;
    }
    try {
      await this.llamarRemoto(metodo, args);
    } catch (e) {
      if (!esErrorDeRed(e)) throw e;
      await this.cola.encolar(metodo, args);
    }
  }

  async guardarTransacciones(transacciones: readonly Transaction[]): Promise<void> {
    await this.escribir('guardarTransacciones', [transacciones]);
  }

  async borrarTransaccion(id: string): Promise<void> {
    await this.escribir('borrarTransaccion', [id]);
  }

  async guardarCajita(cajita: Cajita): Promise<void> {
    await this.escribir('guardarCajita', [cajita]);
  }

  async borrarCajita(id: string): Promise<void> {
    await this.escribir('borrarCajita', [id]);
  }

  async guardarCajitaMovimientos(movimientos: readonly CajitaMovimiento[]): Promise<void> {
    await this.escribir('guardarCajitaMovimientos', [movimientos]);
  }

  async borrarCajitaMovimiento(id: string): Promise<void> {
    await this.escribir('borrarCajitaMovimiento', [id]);
  }

  async guardarMeta(meta: Meta): Promise<void> {
    await this.escribir('guardarMeta', [meta]);
  }

  async borrarMeta(id: string): Promise<void> {
    await this.escribir('borrarMeta', [id]);
  }

  async guardarCategoria(categoria: CategoriaPersonal): Promise<void> {
    await this.escribir('guardarCategoria', [categoria]);
  }

  async borrarCategoria(id: string): Promise<void> {
    await this.escribir('borrarCategoria', [id]);
  }

  async guardarContacto(contacto: Contacto): Promise<void> {
    await this.escribir('guardarContacto', [contacto]);
  }

  async borrarContacto(id: string): Promise<void> {
    await this.escribir('borrarContacto', [id]);
  }

  async guardarPresupuesto(presupuesto: Presupuesto): Promise<void> {
    await this.escribir('guardarPresupuesto', [presupuesto]);
  }

  async borrarPresupuesto(categoria: string): Promise<void> {
    await this.escribir('borrarPresupuesto', [categoria]);
  }

  async guardarRecurrente(recurrente: Recurrente): Promise<void> {
    await this.escribir('guardarRecurrente', [recurrente]);
  }

  async borrarRecurrente(id: string): Promise<void> {
    await this.escribir('borrarRecurrente', [id]);
  }

  /**
   * Igual que cualquier otra escritura: local primero, remoto si hay señal,
   * a la cola si no.
   *
   * La primera versión de esto lo enviaba siempre de inmediato, sin pasar por
   * `escribir()`. Se veía más seguro para algo tan destructivo, pero era un
   * error real: `useAlmacen.restaurar` llama `vaciar()` y LUEGO reescribe todo
   * con una tanda de `guardar*` que sí quedan en cola sin señal. Si `vaciar()`
   * hubiera fallado ahí en medio por falta de conexión, el local ya habría
   * quedado vacío — la restauración parecería haber borrado el libro entero
   * en vez de reemplazarlo. Pasando por la cola igual que el resto, un
   * restaurar offline simplemente encola el vaciado y las escrituras que le
   * siguen, en orden, y sube todo junto cuando vuelva la señal.
   */
  async vaciar(): Promise<void> {
    await this.escribir('vaciar', []);
  }
}
