import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import { senalesDeMovimiento } from './senales';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 20_000,
  category: 'comida',
  description: 'Almuerzo',
  occurredOn: '2026-08-10',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-10T00:00:00.000Z',
  ...over,
});

/** Several prior movements of the same category, to give a baseline. */
const base = (montos: number[], over: Partial<Transaction> = {}) =>
  montos.map((m, i) =>
    tx({ id: `base-${i}`, amountCop: m, occurredOn: `2026-07-0${i + 1}`, ...over }),
  );

const tipos = (t: Transaction, historial: Transaction[]) =>
  senalesDeMovimiento(t, historial).map((s) => s.tipo);

describe('inusual', () => {
  it('flags a movement well above the user own median', () => {
    const grande = tx({ id: 'grande', amountCop: 150_000 });
    const historial = [...base([18_000, 20_000, 22_000, 19_000]), grande];

    const senal = senalesDeMovimiento(grande, historial).find((s) => s.tipo === 'inusual');
    expect(senal).toBeDefined();
    expect(senal!.titulo).toMatch(/× tu gasto habitual en Comida/);
  });

  it('stays quiet without enough history to have a baseline', () => {
    // Calling the second coffee of your life "unusual" is noise, not insight.
    const grande = tx({ id: 'grande', amountCop: 150_000 });
    const historial = [...base([20_000]), grande];

    expect(tipos(grande, historial)).not.toContain('inusual');
  });

  it('uses the median, so one huge past charge does not raise the bar forever', () => {
    const grande = tx({ id: 'grande', amountCop: 150_000 });
    // A single 2M outlier would drag a MEAN above 150.000 and mute this.
    const historial = [...base([18_000, 20_000, 22_000, 19_000, 2_000_000]), grande];

    expect(tipos(grande, historial)).toContain('inusual');
  });

  it('compares only against the same category', () => {
    const comida = tx({ id: 'comida', amountCop: 150_000, category: 'comida' });
    const historial = [...base([1_000_000], { category: 'hogar' }), comida];

    // Rent history must not make an expensive lunch look normal.
    expect(tipos(comida, historial)).not.toContain('inusual');
  });
});

describe('recurrente', () => {
  it('spots a charge that repeats monthly for about the same amount', () => {
    const agosto = tx({ id: 'ago', description: 'Netflix', amountCop: 38_000 });
    const historial = [
      tx({ id: 'may', description: 'Netflix', amountCop: 38_000, occurredOn: '2026-05-10' }),
      tx({ id: 'jun', description: 'Netflix', amountCop: 38_000, occurredOn: '2026-06-10' }),
      tx({ id: 'jul', description: 'Netflix', amountCop: 39_000, occurredOn: '2026-07-10' }),
      agosto,
    ];

    const senal = senalesDeMovimiento(agosto, historial).find((s) => s.tipo === 'recurrente');
    expect(senal?.detalle).toMatch(/4 meses/);
  });

  it('does not call a wildly different amount a subscription', () => {
    const agosto = tx({ id: 'ago', description: 'Netflix', amountCop: 400_000 });
    const historial = [
      tx({ id: 'may', description: 'Netflix', amountCop: 38_000, occurredOn: '2026-05-10' }),
      tx({ id: 'jun', description: 'Netflix', amountCop: 38_000, occurredOn: '2026-06-10' }),
      tx({ id: 'jul', description: 'Netflix', amountCop: 38_000, occurredOn: '2026-07-10' }),
      agosto,
    ];

    expect(tipos(agosto, historial)).not.toContain('recurrente');
  });

  it('needs three distinct months, not three charges in one', () => {
    const hoy = tx({ id: 'd', description: 'Netflix' });
    const historial = [
      tx({ id: 'a', description: 'Netflix', occurredOn: '2026-08-01' }),
      tx({ id: 'b', description: 'Netflix', occurredOn: '2026-08-02' }),
      tx({ id: 'c', description: 'Netflix', occurredOn: '2026-08-03' }),
      hoy,
    ];

    expect(tipos(hoy, historial)).not.toContain('recurrente');
  });
});

describe('hormiga', () => {
  it('adds up small repeats that hide because none is worth noticing', () => {
    const uno = tx({ id: 'u0', description: 'Tinto', amountCop: 3_000 });
    const historial = [
      uno,
      ...Array.from({ length: 5 }, (_, i) =>
        tx({ id: `u${i + 1}`, description: 'Tinto', amountCop: 3_000, occurredOn: '2026-08-11' }),
      ),
    ];

    const senal = senalesDeMovimiento(uno, historial).find((s) => s.tipo === 'hormiga');
    expect(senal?.titulo).toBe('6 veces este mes');
    expect(senal?.detalle).toMatch(/\$18\.000/);
  });

  it('counts only within the month, not across the whole history', () => {
    const uno = tx({ id: 'u0', description: 'Tinto', occurredOn: '2026-08-10' });
    const historial = [
      uno,
      ...Array.from({ length: 8 }, (_, i) =>
        tx({ id: `v${i}`, description: 'Tinto', occurredOn: '2026-05-10' }),
      ),
    ];

    expect(tipos(uno, historial)).not.toContain('hormiga');
  });
});

describe('duplicado', () => {
  it('asks the user to look, without deciding for them', () => {
    const a = tx({ id: 'a', description: 'Para ANA GOMEZ', amountCop: 50_000 });
    const b = tx({ id: 'b', description: 'Para ANA GOMEZ', amountCop: 50_000 });

    const senal = senalesDeMovimiento(a, [a, b]).find((s) => s.tipo === 'duplicado');
    // Two identical coffees are real; the import path depends on that staying
    // allowed. This only flags it.
    expect(senal?.detalle).toMatch(/Puede ser real, o un cobro doble/);
  });

  it('is not raised for the same amount on a different day', () => {
    const a = tx({ id: 'a', amountCop: 50_000, occurredOn: '2026-08-10' });
    const b = tx({ id: 'b', amountCop: 50_000, occurredOn: '2026-08-11' });

    expect(tipos(a, [a, b])).not.toContain('duplicado');
  });
});

describe('creciendo', () => {
  it('reports a counterparty taking noticeably more than before', () => {
    const agosto = tx({ id: 'ago', description: 'Para ANA GOMEZ', amountCop: 300_000 });
    const historial = [
      tx({ id: 'jun', description: 'Para ANA GOMEZ', amountCop: 100_000, occurredOn: '2026-06-05' }),
      tx({ id: 'jul', description: 'Para ANA GOMEZ', amountCop: 100_000, occurredOn: '2026-07-05' }),
      agosto,
    ];

    const senal = senalesDeMovimiento(agosto, historial).find((s) => s.tipo === 'creciendo');
    expect(senal?.titulo).toMatch(/Subió 200%/);
  });

  it('says nothing when the level is steady', () => {
    const agosto = tx({ id: 'ago', description: 'Para ANA GOMEZ', amountCop: 100_000 });
    const historial = [
      tx({ id: 'jun', description: 'Para ANA GOMEZ', amountCop: 100_000, occurredOn: '2026-06-05' }),
      tx({ id: 'jul', description: 'Para ANA GOMEZ', amountCop: 100_000, occurredOn: '2026-07-05' }),
      agosto,
    ];

    expect(tipos(agosto, historial)).not.toContain('creciendo');
  });
});

describe('orden y tono', () => {
  it('puts the most pressing signal first', () => {
    const grande = tx({ id: 'grande', amountCop: 300_000 });
    const gemelo = tx({ id: 'gemelo', amountCop: 300_000 });
    const historial = [...base([18_000, 20_000, 22_000, 19_000]), grande, gemelo];

    const senales = senalesDeMovimiento(grande, historial);
    expect(senales.length).toBeGreaterThan(1);
    expect(senales[0].tono).toBe('alerta');
  });

  it('never judges a movement as good or bad, only as unusual for this user', () => {
    const grande = tx({ id: 'grande', amountCop: 300_000 });
    const historial = [...base([18_000, 20_000, 22_000, 19_000]), grande];

    const texto = senalesDeMovimiento(grande, historial)
      .map((s) => `${s.titulo} ${s.detalle}`)
      .join(' ')
      .toLowerCase();

    // Whether spending is "bad" is a value judgement the app has no standing to
    // make, and one that turns a tool into a scold.
    for (const palabra of ['malo', 'mal gasto', 'innecesario', 'derroche', 'deberías']) {
      expect(texto).not.toContain(palabra);
    }
  });

  it('has nothing to say about an ordinary movement', () => {
    const normal = tx({ id: 'normal', amountCop: 20_000 });
    const historial = [...base([18_000, 20_000, 22_000, 19_000]), normal];

    // Silence is a feature: a badge on everything is a badge on nothing.
    expect(senalesDeMovimiento(normal, historial)).toEqual([]);
  });
});
