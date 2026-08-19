import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { ColaCambios } from './colaCambios';

beforeEach(() => {
  // Base limpia en cada test: sin esto, un `id` autoincremental de un test
  // arrastraría el número al siguiente y el orden dejaría de empezar en 1,
  // que es justo lo que estos tests comprueban.
  globalThis.indexedDB = new IDBFactory();
});

describe('ColaCambios', () => {
  it('empieza vacía', async () => {
    const cola = new ColaCambios('prueba-1');
    expect(await cola.contar()).toBe(0);
    expect(await cola.listar()).toEqual([]);
  });

  it('guarda un cambio con su método y sus argumentos', async () => {
    const cola = new ColaCambios('prueba-2');
    await cola.encolar('guardarTransacciones', [[{ id: 'tx-1' }]]);

    const lista = await cola.listar();
    expect(lista).toHaveLength(1);
    expect(lista[0].metodo).toBe('guardarTransacciones');
    expect(lista[0].args).toEqual([[{ id: 'tx-1' }]]);
  });

  it('mantiene el orden en que se guardaron', async () => {
    const cola = new ColaCambios('prueba-3');
    await cola.encolar('guardarCajita', [{ id: 'a' }]);
    await cola.encolar('guardarCajita', [{ id: 'b' }]);
    await cola.encolar('borrarCajita', ['a']);

    const lista = await cola.listar();
    expect(lista.map((c) => c.args)).toEqual([[{ id: 'a' }], [{ id: 'b' }], ['a']]);
  });

  it('al quitar uno, el resto sigue en su orden', async () => {
    const cola = new ColaCambios('prueba-4');
    await cola.encolar('guardarCajita', [{ id: 'a' }]);
    await cola.encolar('guardarCajita', [{ id: 'b' }]);
    await cola.encolar('guardarCajita', [{ id: 'c' }]);

    const [primero] = await cola.listar();
    await cola.quitar(primero.clave);

    const restantes = await cola.listar();
    expect(restantes.map((c) => (c.args[0] as { id: string }).id)).toEqual(['b', 'c']);
  });

  it('dos colas con nombres distintos no comparten nada', async () => {
    const a = new ColaCambios('cuenta-de-julian');
    const b = new ColaCambios('cuenta-de-otra-persona');

    await a.encolar('guardarTransacciones', [[{ id: 'de-julian' }]]);

    expect(await a.contar()).toBe(1);
    expect(await b.contar()).toBe(0);
  });
});
