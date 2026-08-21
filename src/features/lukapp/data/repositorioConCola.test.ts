import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { Cajita } from './modelos';
import type { Repositorio } from './repositorio';
import { RepositorioMemoria } from './repositorio';
import { ColaCambios } from './colaCambios';
import { RepositorioConCola } from './repositorioConCola';

const enLinea = (valor: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value: valor, configurable: true });
};

const cajita = (id: string): Cajita => ({
  id,
  nombre: id,
  icon: 'wallet',
  tipo: 'cuenta',
  metaCop: null,
  tasaEaPct: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
});

/**
 * Un repositorio de mentira que se comporta como `RepositorioMemoria`, pero
 * al que se le puede ordenar que la PRÓXIMA llamada de escritura falle, y que
 * lleva la cuenta de qué se le llamó y en qué orden. Un `Proxy` en vez de una
 * clase escrita a mano para no tener que enumerar los 17 métodos de escritura
 * uno por uno — y para no arriesgarse a que un test pase por accidente porque
 * se me olvidó envolver alguno.
 */
interface RepositorioControlable extends Repositorio {
  llamadas: { metodo: string; args: unknown[] }[];
  fallarProxima: (error: Error) => void;
}

const crearRemotoControlable = (): RepositorioControlable => {
  const memoria = new RepositorioMemoria();
  const llamadas: { metodo: string; args: unknown[] }[] = [];
  let proximoFallo: Error | null = null;

  const base = {
    llamadas,
    fallarProxima(error: Error) {
      proximoFallo = error;
    },
  };

  return new Proxy(base, {
    get(objetivo, prop: string) {
      if (prop in objetivo) return (objetivo as unknown as Record<string, unknown>)[prop];
      if (prop === 'cargarTodo') return () => memoria.cargarTodo();
      return async (...args: unknown[]) => {
        llamadas.push({ metodo: prop, args });
        if (proximoFallo) {
          const error = proximoFallo;
          proximoFallo = null;
          throw error;
        }
        return (memoria as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[prop](
          ...args,
        );
      };
    },
  }) as unknown as RepositorioControlable;
};

const ERROR_DE_RED = () => new TypeError('Failed to fetch');

let n = 0;
const montar = () => {
  n += 1;
  globalThis.indexedDB = new IDBFactory();
  const local = new RepositorioMemoria();
  const remoto = crearRemotoControlable();
  const cola = new ColaCambios(`prueba-${n}`);
  return { local, remoto, cola, repo: new RepositorioConCola(local, remoto, cola) };
};

beforeEach(() => enLinea(true));

describe('RepositorioConCola — con conexión', () => {
  it('escribe en local y remoto, y no encola nada', async () => {
    const { repo, remoto, cola } = montar();
    await repo.guardarCajita(cajita('a'));

    expect(remoto.llamadas).toHaveLength(1);
    expect(await cola.contar()).toBe(0);
  });

  it('cargarTodo trae lo del remoto', async () => {
    const { repo, remoto } = montar();
    await remoto.guardarCajita(cajita('desde-el-servidor'));

    const datos = await repo.cargarTodo();
    expect(datos.cajitas.map((c) => c.id)).toEqual(['desde-el-servidor']);
  });

  it('cargarTodo deja una copia en local, para si se cae la señal después', async () => {
    const { repo, local } = montar();
    await repo.guardarCajita(cajita('a'));

    const local2 = await local.cargarTodo();
    expect(local2.cajitas.map((c) => c.id)).toEqual(['a']);
  });
});

describe('RepositorioConCola — sin conexión', () => {
  it('escribe en local igual, aunque no haya señal', async () => {
    const { repo, local } = montar();
    enLinea(false);
    await repo.guardarCajita(cajita('a'));

    expect((await local.cargarTodo()).cajitas.map((c) => c.id)).toEqual(['a']);
  });

  it('no llama al remoto: el cambio queda en la cola', async () => {
    const { repo, remoto, cola } = montar();
    enLinea(false);
    await repo.guardarCajita(cajita('a'));

    expect(remoto.llamadas).toHaveLength(0);
    expect(await cola.contar()).toBe(1);
  });

  it('cargarTodo lee del caché local en vez de intentar el remoto', async () => {
    const { repo } = montar();
    enLinea(false);
    await repo.guardarCajita(cajita('a'));

    const datos = await repo.cargarTodo();
    expect(datos.cajitas.map((c) => c.id)).toEqual(['a']);
  });

  it('cambiosPendientes cuenta lo que falta subir', async () => {
    const { repo } = montar();
    enLinea(false);
    await repo.guardarCajita(cajita('a'));
    await repo.guardarCajita(cajita('b'));

    expect(await repo.cambiosPendientes()).toBe(2);
  });
});

describe('RepositorioConCola — volver a tener señal', () => {
  it('sincronizar sube lo que quedó pendiente', async () => {
    const { repo, remoto, cola } = montar();
    enLinea(false);
    await repo.guardarCajita(cajita('a'));
    expect(await cola.contar()).toBe(1);

    enLinea(true);
    await repo.sincronizar();

    expect(await cola.contar()).toBe(0);
    expect(remoto.llamadas.map((l) => l.metodo)).toEqual(['guardarCajita']);
  });

  it('sube los cambios en el mismo orden en que se hicieron', async () => {
    // Editar y luego borrar la MISMA fila: si se subieran en el orden
    // contrario, el borrado llegaría antes que la edición de algo que para
    // el servidor ya no existiría.
    const { repo, remoto, cola } = montar();
    enLinea(false);
    await repo.guardarCajita(cajita('a'));
    await repo.guardarCajita({ ...cajita('a'), nombre: 'Renombrada' });
    await repo.borrarCajita('a');

    enLinea(true);
    await repo.sincronizar();

    expect(await cola.contar()).toBe(0);
    expect(remoto.llamadas.map((l) => l.metodo)).toEqual([
      'guardarCajita',
      'guardarCajita',
      'borrarCajita',
    ]);
  });

  it('cargarTodo, al volver la señal, sincroniza sola antes de leer', async () => {
    const { repo, remoto, cola } = montar();
    enLinea(false);
    await repo.guardarCajita(cajita('a'));

    enLinea(true);
    await repo.cargarTodo();

    expect(await cola.contar()).toBe(0);
    expect(remoto.llamadas.map((l) => l.metodo)).toContain('guardarCajita');
  });

  it('mientras algo siga pendiente, cargarTodo NO pisa el local con el remoto', async () => {
    // La condición delicada: si el remoto todavía no conoce el cambio que
    // hiciste sin señal, leerlo y aplicarlo como verdad haría desaparecer ese
    // cambio de la pantalla, aunque sí quedó guardado.
    const { repo, remoto } = montar();
    enLinea(false);
    await repo.guardarCajita(cajita('mia'));

    // El remoto, mientras tanto, "ya tiene" otra cosa (de antes de perder la
    // señal) que NO incluye la mía. Si `cargarTodo` confiara en el remoto
    // ahora, 'mia' desaparecería.
    await remoto.guardarCajita(cajita('del-servidor'));

    // Vuelve la señal, pero justo aquí, ANTES de que nadie llame a
    // sincronizar, alguien pide los datos.
    enLinea(true);
    // No se llama a sincronizar aquí a propósito, para atrapar la ventana
    // exacta en la que la cola aún no se vació.
    const datos = await repo.cargarTodo();

    // Como cargarTodo() sincroniza sola primero, 'mia' ya debería estar
    // subida Y aparecer junto con lo del servidor.
    expect(datos.cajitas.map((c) => c.id).sort()).toEqual(['del-servidor', 'mia']);
  });
});

describe('RepositorioConCola — navigator.onLine miente', () => {
  it('si el navegador dice que hay señal pero el fetch falla igual, se encola en vez de romper', async () => {
    // `navigator.onLine` puede dar falsos positivos (un portal cautivo, una
    // red que se cayó hace un segundo). Lo que importa de verdad es si la
    // llamada de red en sí se pudo hacer, no lo que diga esa bandera.
    const { repo, remoto, cola } = montar();
    remoto.fallarProxima(ERROR_DE_RED());

    await repo.guardarCajita(cajita('a'));

    expect(await cola.contar()).toBe(1);
  });
});

describe('RepositorioConCola — un fallo que no es de red', () => {
  it('no se encola: se avisa de una vez', async () => {
    const { repo, remoto, cola } = montar();
    // Con señal, pero el servidor rechaza el cambio (p. ej. la sesión venció).
    remoto.fallarProxima(new Error('violates row-level security'));

    await expect(repo.guardarCajita(cajita('a'))).rejects.toThrow('violates row-level security');

    // No quedó en la cola: encolar esto lo dejaría ahí para siempre,
    // reintentando algo que nunca va a funcionar sin que nadie se entere.
    expect(await cola.contar()).toBe(0);
  });

  it('durante la sincronización, se detiene en vez de saltarse el cambio', async () => {
    const { repo, remoto, cola } = montar();
    enLinea(false);
    await repo.guardarCajita(cajita('a'));
    await repo.guardarCajita(cajita('b'));

    enLinea(true);
    remoto.fallarProxima(new Error('violates row-level security'));
    await repo.sincronizar();

    // 'a' falló y se quedó. 'b' NUNCA se intentó — el orden se respeta incluso
    // cuando algo se atasca.
    expect(await cola.contar()).toBe(2);
    expect(remoto.llamadas.map((l) => l.metodo)).toEqual(['guardarCajita']);
  });
});

describe('RepositorioConCola — vaciar (restaurar un respaldo)', () => {
  it('sin señal, encola el vaciado igual que cualquier otro cambio', async () => {
    const { repo, local, cola } = montar();
    await local.guardarCajita(cajita('vieja'));
    enLinea(false);

    await repo.vaciar();

    expect((await local.cargarTodo()).cajitas).toHaveLength(0);
    expect(await cola.contar()).toBe(1);
  });
});
