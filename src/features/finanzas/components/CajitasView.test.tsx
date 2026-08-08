import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Cajita, CajitaMovimiento, CajitaTipo } from '../data/modelos';
import { CajitasView } from './CajitasView';

const caj = (over: Partial<Cajita> = {}): Cajita => ({
  id: 'c1',
  nombre: 'Nequi',
  icon: 'PiggyBank',
  tipo: 'cuenta',
  metaCop: null,
  tasaEaPct: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

const mov = (over: Partial<CajitaMovimiento> = {}): CajitaMovimiento => ({
  id: 'm1',
  cajitaId: 'c1',
  kind: 'deposito',
  deltaCop: 500_000,
  categoria: null,
  occurredOn: '2026-08-01',
  nota: '',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

const AMBOS: Cajita[] = [
  caj({ id: 'banco', nombre: 'Bancolombia', tipo: 'cuenta' }),
  caj({ id: 'pote', nombre: 'Vacaciones', tipo: 'cajita' }),
];

const montar = (tipo: CajitaTipo, cajitas: Cajita[] = AMBOS, movimientos: CajitaMovimiento[] = []) => {
  const onCrear = vi.fn();
  render(
    <CajitasView
      tipo={tipo}
      cajitas={cajitas}
      movimientos={movimientos}
      onCrear={onCrear}
      onFijarSaldo={vi.fn()}
      onMovimiento={vi.fn()}
      onEliminar={vi.fn()}
    />,
  );
  return { onCrear };
};

describe('CajitasView — cuentas y cajitas son módulos separados', () => {
  it('la pantalla de cuentas no muestra cajitas', () => {
    montar('cuenta');

    expect(screen.getByText('Bancolombia')).toBeInTheDocument();
    expect(screen.queryByText('Vacaciones')).not.toBeInTheDocument();
  });

  it('la pantalla de cajitas no muestra cuentas', () => {
    montar('cajita');

    expect(screen.getByText('Vacaciones')).toBeInTheDocument();
    expect(screen.queryByText('Bancolombia')).not.toBeInTheDocument();
  });

  it('el total de cada pantalla cuenta solo lo suyo', () => {
    montar('cuenta', AMBOS, [
      mov({ id: 'a', cajitaId: 'banco', deltaCop: 600_000 }),
      mov({ id: 'b', cajitaId: 'pote', deltaCop: 400_000 }),
    ]);

    // 600.000 de la cuenta; los 400.000 de la cajita no se suman aquí. La cifra
    // se repite (total y tarjeta), así que lo que se afirma es la ausencia de
    // la suma combinada, que es la regresión que importa.
    expect(screen.getAllByText('$600.000').length).toBeGreaterThan(0);
    expect(screen.queryByText('$1.000.000')).not.toBeInTheDocument();
    expect(screen.queryByText('$400.000')).not.toBeInTheDocument();
  });

  it('ya no pregunta "¿Qué es?" — la pantalla en la que estás lo responde', () => {
    montar('cuenta', []);

    fireEvent.click(screen.getByRole('button', { name: /Agregar cuenta bancaria/ }));

    expect(screen.queryByText('¿Qué es?')).not.toBeInTheDocument();
  });

  it('crea con el tipo de su pantalla, sin que el usuario lo elija', () => {
    const { onCrear } = montar('cuenta', []);

    fireEvent.click(screen.getByRole('button', { name: /Agregar cuenta bancaria/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Davivienda' } });
    fireEvent.change(screen.getByLabelText('¿Cuánto tienes en esta cuenta?'), {
      target: { value: '250000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(onCrear).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Davivienda', tipo: 'cuenta', saldoInicialCop: 250000 }),
    );
  });

  it('no ofrece meta ni rendimiento en una cuenta bancaria', () => {
    montar('cuenta', []);
    fireEvent.click(screen.getByRole('button', { name: /Agregar cuenta bancaria/ }));

    // Una cuenta corriente no tiene meta de ahorro ni una tasa que el usuario
    // deba escribir; ofrecerlas solo alarga el formulario.
    expect(screen.queryByText(/Meta a la que quieres llegar/)).not.toBeInTheDocument();
    expect(screen.queryByText('Rendimiento (opcional)')).not.toBeInTheDocument();
  });

  it('sí las ofrece en una cajita, donde sí significan algo', () => {
    montar('cajita', []);
    fireEvent.click(screen.getByRole('button', { name: /Nueva cajita/ }));

    expect(screen.getByText(/Meta a la que quieres llegar/)).toBeInTheDocument();
    expect(screen.getByText('Rendimiento (opcional)')).toBeInTheDocument();
  });

  it('cada pantalla tiene su propio vacío, no uno compartido', () => {
    const { unmount } = render(
      <CajitasView
        tipo="cuenta"
        cajitas={[]}
        movimientos={[]}
        onCrear={vi.fn()}
        onFijarSaldo={vi.fn()}
        onMovimiento={vi.fn()}
        onEliminar={vi.fn()}
      />,
    );
    expect(screen.getByText('Aún no tienes cuentas.')).toBeInTheDocument();
    unmount();

    montar('cajita', []);
    expect(screen.getByText('Aún no tienes cajitas.')).toBeInTheDocument();
  });
});

describe('CajitasView — una cuenta no se comporta como una cajita', () => {
  const conSaldo = [mov({ cajitaId: 'banco', deltaCop: 500_000 })];

  it('una cuenta ofrece solo actualizar el saldo', () => {
    montar('cuenta', AMBOS, conSaldo);

    expect(screen.getByRole('button', { name: 'Actualizar saldo' })).toBeInTheDocument();
    // Lo que entra y sale de un banco ya son ingresos y gastos en Movimientos;
    // repetirlo aquí sería un segundo historial del mismo dinero.
    expect(screen.queryByRole('button', { name: 'Depositar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retirar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rendimiento' })).not.toBeInTheDocument();
  });

  it('una cajita sí ofrece las cuatro', () => {
    montar('cajita', AMBOS, [mov({ cajitaId: 'pote', deltaCop: 500_000 })]);

    for (const accion of ['Actualizar saldo', 'Depositar', 'Retirar', 'Rendimiento']) {
      expect(screen.getByRole('button', { name: accion })).toBeInTheDocument();
    }
  });

  it('una cuenta no se llama "cajita" en ningún texto', () => {
    montar('cuenta', AMBOS, conSaldo);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar saldo' }));

    expect(screen.getByText('¿Cuánto tienes ahora en esta cuenta?')).toBeInTheDocument();
    expect(screen.queryByText(/en esta cajita/)).not.toBeInTheDocument();
  });

  it('borrar una cuenta avisa que los movimientos no se tocan', () => {
    montar('cuenta', AMBOS, conSaldo);

    fireEvent.click(screen.getByRole('button', { name: /Eliminar cuenta: Bancolombia/ }));

    expect(screen.getByText(/Tus movimientos registrados no se tocan/)).toBeInTheDocument();
  });

  it('una cuenta no muestra rendimiento estimado, aunque tenga tasa', () => {
    montar(
      'cuenta',
      [caj({ id: 'banco', nombre: 'Bancolombia', tipo: 'cuenta', tasaEaPct: 13 })],
      conSaldo,
    );

    expect(screen.queryByText('Rendimiento estimado')).not.toBeInTheDocument();
  });
});
