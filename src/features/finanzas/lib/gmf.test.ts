import { describe, it, expect } from 'vitest';
import type { Transaction } from '../types';
import {
  ADVERTENCIA_GMF,
  NOTAS_GMF,
  TARIFA_GMF,
  TOPE_EXENTO_UVT,
  UVT_POR_DEFECTO,
  consumoDelMes,
  gmfDe,
  topeExentoCop,
  uvtDesactualizada,
} from './gmf';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 1_000_000,
  category: 'otros',
  description: 'Retiro',
  occurredOn: '2026-08-10',
  cuentaId: 'nequi',
  rawTranscript: '',
  createdAt: '2026-08-10T00:00:00.000Z',
  ...over,
});

const CUBIERTAS = new Set(['nequi', 'banco']);

describe('la tarifa y el tope', () => {
  it('cobra cuatro por mil', () => {
    expect(TARIFA_GMF).toBe(0.004);
    expect(gmfDe(1_000_000)).toBe(4_000);
    expect(gmfDe(250_000)).toBe(1_000);
  });

  it('redondea a pesos, porque no existen centavos de peso', () => {
    expect(Number.isInteger(gmfDe(12_345))).toBe(true);
  });

  it('no le importa el signo del monto', () => {
    expect(gmfDe(-500_000)).toBe(gmfDe(500_000));
  });

  it('el tope exento son 350 UVT del año que se le pase', () => {
    expect(TOPE_EXENTO_UVT).toBe(350);
    expect(topeExentoCop(UVT_POR_DEFECTO)).toBe(350 * UVT_POR_DEFECTO.pesos);
    expect(topeExentoCop({ anio: 2025, pesos: 49_799, fuente: '' })).toBe(350 * 49_799);
  });
});

describe('el valor de la UVT', () => {
  it('viene con año y con la resolución que lo fijó', () => {
    // Un dato tributario sin fecha ni fuente es peor que no decir nada.
    expect(UVT_POR_DEFECTO.anio).toBe(2026);
    expect(UVT_POR_DEFECTO.pesos).toBe(52_374);
    expect(UVT_POR_DEFECTO.fuente).toMatch(/DIAN/);
  });

  it('se sabe vieja cuando cambia el año', () => {
    // La UVT cambia cada enero. Sin esto la app calcularía con el número del
    // año pasado sin decir nada.
    expect(uvtDesactualizada(UVT_POR_DEFECTO, 2026)).toBe(false);
    expect(uvtDesactualizada(UVT_POR_DEFECTO, 2027)).toBe(true);
  });
});

describe('consumo del cupo exento', () => {
  it('suma los retiros del mes contra el tope', () => {
    const c = consumoDelMes([tx({ amountCop: 2_000_000 })], '2026-08', UVT_POR_DEFECTO, CUBIERTAS);

    expect(c.baseCop).toBe(2_000_000);
    expect(c.topeCop).toBe(18_330_900);
    expect(c.disponibleCop).toBe(16_330_900);
    expect(c.gravadoCop).toBe(0);
    expect(c.gmfEstimadoCop).toBe(0);
  });

  it('un ingreso NO consume cupo', () => {
    // El impuesto grava disponer del dinero, no recibirlo.
    const c = consumoDelMes(
      [tx({ kind: 'ingreso', amountCop: 5_000_000 })],
      '2026-08',
      UVT_POR_DEFECTO,
      CUBIERTAS,
    );

    expect(c.baseCop).toBe(0);
  });

  it('un movimiento sin cuenta asignada queda fuera', () => {
    // No se sabe si salió de un banco o del bolsillo, y contarlo infla el
    // consumo con plata que quizá nunca tocó una cuenta.
    const c = consumoDelMes([tx({ cuentaId: null })], '2026-08', UVT_POR_DEFECTO, CUBIERTAS);

    expect(c.baseCop).toBe(0);
  });

  it('una cuenta que no está cubierta tampoco cuenta', () => {
    const c = consumoDelMes([tx({ cuentaId: 'otra' })], '2026-08', UVT_POR_DEFECTO, CUBIERTAS);

    expect(c.baseCop).toBe(0);
  });

  it('sin cuentas cubiertas el consumo es cero, no todo el libro', () => {
    const c = consumoDelMes([tx()], '2026-08', UVT_POR_DEFECTO, new Set());

    expect(c.baseCop).toBe(0);
    expect(c.gmfEstimadoCop).toBe(0);
  });

  it('ignora los meses que no son', () => {
    const c = consumoDelMes(
      [tx({ occurredOn: '2026-07-31' }), tx({ id: 't2', occurredOn: '2026-09-01' })],
      '2026-08',
      UVT_POR_DEFECTO,
      CUBIERTAS,
    );

    expect(c.baseCop).toBe(0);
  });

  it('cobra solo sobre el exceso, nunca sobre todo', () => {
    // El error clásico: creer que pasarse del cupo grava el mes entero.
    const tope = topeExentoCop(UVT_POR_DEFECTO);
    const c = consumoDelMes(
      [tx({ amountCop: tope + 1_000_000 })],
      '2026-08',
      UVT_POR_DEFECTO,
      CUBIERTAS,
    );

    expect(c.gravadoCop).toBe(1_000_000);
    expect(c.gmfEstimadoCop).toBe(4_000);
  });

  it('justo en el tope todavía no cobra', () => {
    const c = consumoDelMes(
      [tx({ amountCop: topeExentoCop(UVT_POR_DEFECTO) })],
      '2026-08',
      UVT_POR_DEFECTO,
      CUBIERTAS,
    );

    expect(c.gravadoCop).toBe(0);
    expect(c.disponibleCop).toBe(0);
    expect(c.pctUsado).toBe(100);
  });

  it('el porcentaje no se pasa de 100 aunque el gasto sí', () => {
    const c = consumoDelMes(
      [tx({ amountCop: topeExentoCop(UVT_POR_DEFECTO) * 3 })],
      '2026-08',
      UVT_POR_DEFECTO,
      CUBIERTAS,
    );

    expect(c.pctUsado).toBe(100);
    expect(c.disponibleCop).toBe(0);
  });

  it('suma entre cuentas distintas, porque el cupo es de la persona', () => {
    // Desde diciembre de 2024 el cupo no es de una cuenta marcada: es tuyo, y
    // se reparte entre las que tengas.
    const c = consumoDelMes(
      [
        tx({ id: 'a', cuentaId: 'nequi', amountCop: 3_000_000 }),
        tx({ id: 'b', cuentaId: 'banco', amountCop: 2_000_000 }),
      ],
      '2026-08',
      UVT_POR_DEFECTO,
      CUBIERTAS,
    );

    expect(c.baseCop).toBe(5_000_000);
  });

  it('un mes sin nada da ceros, no NaN', () => {
    const c = consumoDelMes([], '2026-08', UVT_POR_DEFECTO, CUBIERTAS);

    expect(c).toMatchObject({ baseCop: 0, gravadoCop: 0, gmfEstimadoCop: 0, pctUsado: 0 });
  });
});

describe('lo que la app afirma', () => {
  it('cada nota trae su fundamento y cuándo se verificó', () => {
    // Esto es normativa: envejece. Una afirmación tributaria sin fuente ni
    // fecha no debería llegar a la pantalla.
    expect(NOTAS_GMF.length).toBeGreaterThan(3);
    for (const nota of NOTAS_GMF) {
      expect(nota.fundamento.trim()).not.toBe('');
      expect(nota.verificado).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(nota.cuerpo.length).toBeGreaterThan(40);
    }
  });

  it('dice explícitamente que el banco es quien liquida', () => {
    expect(ADVERTENCIA_GMF).toMatch(/banco/i);
    expect(ADVERTENCIA_GMF).toMatch(/estimaci/i);
  });

  it('cuenta el cambio de 2024, que es lo que casi nadie sabe', () => {
    const nota = NOTAS_GMF.find((n) => n.id === 'ya-no-se-marca');

    expect(nota).toBeDefined();
    expect(nota!.cuerpo).toMatch(/13 de diciembre de 2024/);
    expect(nota!.fundamento).toMatch(/881-1/);
  });
});

describe('los dos regímenes', () => {
  const tope = 18_330_900;
  const MOVS = [
    tx({ id: 'a', cuentaId: 'nequi', amountCop: 2_000_000 }),
    tx({ id: 'b', cuentaId: 'banco', amountCop: 3_000_000 }),
  ];

  it('distribuido: el cupo es de la persona y suma todas sus cuentas', () => {
    const c = consumoDelMes(MOVS, '2026-08', UVT_POR_DEFECTO, CUBIERTAS, {
      regimen: 'distribuido',
    });

    expect(c.baseCop).toBe(5_000_000);
    expect(c.sinCupoCop).toBe(0);
    expect(c.gmfEstimadoCop).toBe(0);
  });

  it('marcada: solo la cuenta elegida goza del cupo', () => {
    const c = consumoDelMes(MOVS, '2026-08', UVT_POR_DEFECTO, CUBIERTAS, {
      regimen: 'marcada',
      cuentaExentaId: 'nequi',
    });

    expect(c.baseCop).toBe(2_000_000);
    // Lo de la otra cuenta paga desde el primer peso.
    expect(c.sinCupoCop).toBe(3_000_000);
    expect(c.gmfEstimadoCop).toBe(gmfDe(3_000_000));
  });

  it('marcada: lo de las otras cuentas NO consume el cupo', () => {
    // Meterlo en la base haría creer que el cupo se agotó cuando ni siquiera
    // aplicaba a esa plata.
    const c = consumoDelMes(MOVS, '2026-08', UVT_POR_DEFECTO, CUBIERTAS, {
      regimen: 'marcada',
      cuentaExentaId: 'nequi',
    });

    expect(c.disponibleCop).toBe(tope - 2_000_000);
  });

  it('marcada sin cuenta elegida: nada goza del cupo', () => {
    const c = consumoDelMes(MOVS, '2026-08', UVT_POR_DEFECTO, CUBIERTAS, {
      regimen: 'marcada',
      cuentaExentaId: null,
    });

    expect(c.baseCop).toBe(0);
    expect(c.sinCupoCop).toBe(5_000_000);
  });

  it('marcada: la cuenta elegida también paga si se pasa del cupo', () => {
    const c = consumoDelMes(
      [tx({ cuentaId: 'nequi', amountCop: tope + 500_000 })],
      '2026-08',
      UVT_POR_DEFECTO,
      CUBIERTAS,
      { regimen: 'marcada', cuentaExentaId: 'nequi' },
    );

    expect(c.gravadoCop).toBe(500_000);
  });

  it('el régimen por defecto es el que dice la norma hoy', () => {
    // Sin decir nada se asume `distribuido`, que es lo vigente desde el
    // 13 de diciembre de 2024.
    const conDefecto = consumoDelMes(MOVS, '2026-08', UVT_POR_DEFECTO, CUBIERTAS);
    const explicito = consumoDelMes(MOVS, '2026-08', UVT_POR_DEFECTO, CUBIERTAS, {
      regimen: 'distribuido',
    });

    expect(conDefecto).toEqual(explicito);
  });

  it('el régimen viejo nunca sale más barato que el nuevo', () => {
    // Si alguna vez lo hiciera, el cálculo estaría mal: el esquema distribuido
    // existe justamente para no perder cupo por usar varias cuentas.
    const nuevo = consumoDelMes(MOVS, '2026-08', UVT_POR_DEFECTO, CUBIERTAS, {
      regimen: 'distribuido',
    });
    const viejo = consumoDelMes(MOVS, '2026-08', UVT_POR_DEFECTO, CUBIERTAS, {
      regimen: 'marcada',
      cuentaExentaId: 'nequi',
    });

    expect(viejo.gmfEstimadoCop).toBeGreaterThanOrEqual(nuevo.gmfEstimadoCop);
  });
});
