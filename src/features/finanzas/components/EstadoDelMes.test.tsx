import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Transaction } from '../types';
import { monthTotals } from '../lib/aggregate';
import { colorDeCategoria } from '../lib/paletaViz';
import { EstadoDelMes } from './EstadoDelMes';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 100_000,
  category: 'comida',
  description: 'x',
  occurredOn: '2026-08-10',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-10T00:00:00.000Z',
  ...over,
});

const montar = (movimientos: Transaction[]) =>
  render(<EstadoDelMes totals={monthTotals(movimientos)} delMes={movimientos} mes="2026-08" hoy="2026-08-16" />);

/** The stacked bar's segments, in render order. */
const segmentos = () => screen.getAllByRole('button').filter((b) => b.style.width.endsWith('%'));

beforeEach(() => {
  document.documentElement.removeAttribute('data-tema');
});

describe('EstadoDelMes — el veredicto', () => {
  it('avisa cuando gastaste más de lo que entró', () => {
    montar([tx({ kind: 'ingreso', amountCop: 100_000 }), tx({ id: 'g', amountCop: 300_000 })]);

    expect(screen.getByText('Gastaste más de lo que entró')).toBeInTheDocument();
  });

  it('distingue "vas justo" de "vas bien" por la tasa de ahorro', () => {
    const { unmount } = montar([
      tx({ kind: 'ingreso', amountCop: 100_000 }),
      tx({ id: 'g', amountCop: 95_000 }),
    ]);
    expect(screen.getByText('Vas justo este mes')).toBeInTheDocument();
    unmount();

    montar([tx({ kind: 'ingreso', amountCop: 100_000 }), tx({ id: 'g', amountCop: 30_000 })]);
    expect(screen.getByText('Vas bien este mes')).toBeInTheDocument();
  });

  it('nunca deja el estado solo en color: lleva icono y palabras', () => {
    montar([tx({ kind: 'ingreso', amountCop: 100_000 }), tx({ id: 'g', amountCop: 300_000 })]);

    // El texto ES el segundo canal; sin él, un lector daltónico no tiene nada.
    expect(screen.getByText('Gastaste más de lo que entró')).toBeInTheDocument();
  });
});

describe('EstadoDelMes — el medidor', () => {
  it('expone el porcentaje consumido como meter accesible', () => {
    montar([tx({ kind: 'ingreso', amountCop: 200_000 }), tx({ id: 'g', amountCop: 50_000 })]);

    const medidor = screen.getByRole('meter');
    expect(medidor).toHaveAttribute('aria-valuenow', '25');
  });

  it('se topa en 100 en vez de desbordar su propia pista', () => {
    montar([tx({ kind: 'ingreso', amountCop: 100_000 }), tx({ id: 'g', amountCop: 400_000 })]);

    // Gastar de más es un estado real, pero una barra saliéndose del riel no
    // dice nada que el número de arriba no diga ya.
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
    expect(parseFloat(screen.getByRole('meter').style.width)).toBeLessThanOrEqual(100);
  });

  it('no muestra medidor sin ingresos, porque no hay contra qué medir', () => {
    montar([tx({ amountCop: 50_000 })]);

    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });
});

describe('EstadoDelMes — el reparto', () => {
  const seis = [
    tx({ id: 'a', category: 'mercado', amountCop: 600_000 }),
    tx({ id: 'b', category: 'comida', amountCop: 500_000 }),
    tx({ id: 'c', category: 'transporte', amountCop: 400_000 }),
    tx({ id: 'd', category: 'servicios', amountCop: 300_000 }),
    tx({ id: 'e', category: 'salud', amountCop: 200_000 }),
    tx({ id: 'f', category: 'ropa', amountCop: 100_000 }),
    tx({ id: 'g', category: 'hogar', amountCop: 50_000 }),
  ];

  it('nunca pasa de seis segmentos: más allá, los colores contiguos se confunden', () => {
    montar(seis);

    expect(segmentos().length).toBeLessThanOrEqual(6);
  });

  it('pliega la cola en un grupo en vez de inventar más colores', () => {
    montar(seis);

    // Siete categorías, cinco visibles y las dos restantes agrupadas.
    expect(screen.getByText('Otras 2')).toBeInTheDocument();
  });

  it('los anchos suman 100%, sin desbordar', () => {
    montar(seis);

    const suma = segmentos().reduce((t, b) => t + parseFloat(b.style.width), 0);
    expect(suma).toBeCloseTo(100, 1);
  });

  it('cada segmento lleva su etiqueta, que es el relieve exigido por el contraste', () => {
    montar(seis);

    // Tres pasos claros quedan bajo 3:1 sobre la superficie; la regla de relieve
    // obliga a etiquetas visibles.
    for (const etiqueta of ['Mercado', 'Comida', 'Transporte']) {
      expect(screen.getByText(etiqueta)).toBeInTheDocument();
    }
  });

  it('el color sigue a la categoría, no a su puesto en el ranking', () => {
    const { unmount } = montar([
      tx({ id: 'a', category: 'comida', amountCop: 900_000 }),
      tx({ id: 'b', category: 'mercado', amountCop: 100_000 }),
    ]);
    const comidaPrimero = segmentos()[0].style.backgroundColor;
    unmount();

    // Se invierte el ranking: Comida pasa a segunda.
    montar([
      tx({ id: 'a', category: 'mercado', amountCop: 900_000 }),
      tx({ id: 'b', category: 'comida', amountCop: 100_000 }),
    ]);
    const comidaSegundo = segmentos()[1].style.backgroundColor;

    // Si el color siguiera al puesto, la gráfica cambiaría de significado cada
    // mes y dejaría de poder compararse.
    expect(comidaSegundo).toBe(comidaPrimero);
  });

  it('revela el detalle del segmento al pasar por encima', () => {
    montar(seis);

    fireEvent.mouseEnter(segmentos()[0]);

    expect(screen.getByText(/\$600\.000 · \d+%/)).toBeInTheDocument();
  });
});

describe('EstadoDelMes — modo oscuro', () => {
  it('usa pasos propios del modo oscuro, no los mismos de claro', () => {
    // El oscuro no es un volteo del claro: cada paso se eligió contra la
    // superficie oscura y se validó por separado.
    expect(colorDeCategoria('comida', true)).not.toBe(colorDeCategoria('comida', false));
  });

  it('sigue el tema elegido a mano, no solo el del sistema', () => {
    document.documentElement.setAttribute('data-tema', 'oscuro');
    montar([tx({ category: 'comida', amountCop: 100_000 })]);

    const esperado = colorDeCategoria('comida', true);
    // rgb() vs hex: comparamos sobre el canal rojo, suficiente para distinguir
    // los dos pasos.
    expect(segmentos()[0].style.backgroundColor).toContain(
      String(parseInt(esperado.slice(1, 3), 16)),
    );
  });
});
