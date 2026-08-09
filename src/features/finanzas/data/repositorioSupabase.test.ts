import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cajita, CajitaTipo } from './modelos';
import { ES_PASIVO } from './modelos';
import { RepositorioSupabase } from './repositorioSupabase';

const TIPOS = Object.keys(ES_PASIVO) as CajitaTipo[];

/** Minimal client that replays fixed rows, so the mappers can be exercised. */
const clienteCon = (cajitas: Record<string, unknown>[]) => {
  const vacio = { data: [], error: null };
  const guardado: Record<string, unknown>[] = [];

  const cliente = {
    from: (tabla: string) => ({
      select: () => ({
        eq: () =>
          Promise.resolve(tabla === 'cajitas' ? { data: cajitas, error: null } : vacio),
      }),
      upsert: (filas: Record<string, unknown> | Record<string, unknown>[]) => {
        guardado.push(...(Array.isArray(filas) ? filas : [filas]));
        return Promise.resolve({ error: null });
      },
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  } as unknown as SupabaseClient;

  return { cliente, guardado };
};

const fila = (tipo: string) => ({
  id: `c-${tipo}`,
  nombre: tipo,
  emoji: 'PiggyBank',
  tipo,
  meta_cop: null,
  tasa_ea_pct: null,
  created_at: '2026-08-01T00:00:00.000Z',
  archived_at: null,
});

describe('RepositorioSupabase — el tipo de una cajita', () => {
  it('lee de vuelta CADA tipo tal como se guardó', async () => {
    // El fallo original: la lectura era `tipo === 'cuenta' ? 'cuenta' : 'cajita'`,
    // escrita cuando solo existían esos dos. Una tarjeta se guardaba bien y
    // volvía como cajita, así que una deuda creada en Deudas aparecía en Ahorro.
    const { cliente } = clienteCon(TIPOS.map((t) => fila(t)));

    const { cajitas } = await new RepositorioSupabase(cliente, 'u1').cargarTodo();

    expect(cajitas.map((c) => c.tipo).sort()).toEqual([...TIPOS].sort());
  });

  it('cubre todos los tipos que el modelo declara, no una lista aparte', () => {
    // Si mañana aparece un quinto tipo, este test lo exige sin que nadie
    // recuerde volver aquí.
    expect(TIPOS.length).toBeGreaterThanOrEqual(4);
    expect(TIPOS).toContain('deuda');
    expect(TIPOS).toContain('tarjeta');
  });

  it('cae en cajita solo ante un valor que de verdad no conoce', async () => {
    const { cliente } = clienteCon([fila('marciano')]);

    const { cajitas } = await new RepositorioSupabase(cliente, 'u1').cargarTodo();

    expect(cajitas[0].tipo).toBe('cajita');
  });

  it('escribe el tipo sin transformarlo', async () => {
    const { cliente, guardado } = clienteCon([]);
    const tarjeta: Cajita = {
      id: 'c1',
      nombre: 'Credito NU',
      icon: 'CreditCard',
      tipo: 'tarjeta',
      metaCop: null,
      tasaEaPct: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      archivedAt: null,
    };

    await new RepositorioSupabase(cliente, 'u1').guardarCajita(tarjeta);

    expect(guardado[0]).toMatchObject({ tipo: 'tarjeta', user_id: 'u1' });
  });
});

describe('RepositorioSupabase — errores legibles', () => {
  it('traduce una restricción de Postgres a algo accionable', async () => {
    const cliente = {
      from: () => ({
        upsert: () =>
          Promise.resolve({
            error: { message: 'violates check constraint "transacciones_amount_cop_check"' },
          }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      new RepositorioSupabase(cliente, 'u1').guardarTransacciones([
        {
          id: 't1',
          kind: 'gasto',
          amountCop: 0,
          category: 'otros',
          description: '',
          occurredOn: '2026-08-01',
          cuentaId: null,
          rawTranscript: '',
          createdAt: '2026-08-01T00:00:00.000Z',
        },
      ]),
    ).rejects.toThrow('El monto debe ser mayor que cero.');
  });
});

