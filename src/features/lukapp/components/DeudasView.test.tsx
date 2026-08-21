import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Cajita, CajitaMovimiento } from '../data/modelos';
import { DeudasView } from './DeudasView';

const caj = (over: Partial<Cajita> = {}): Cajita => ({
  id: 'd1',
  nombre: 'Visa Davivienda',
  icon: 'CreditCard',
  tipo: 'tarjeta',
  metaCop: null,
  tasaEaPct: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

const mov = (over: Partial<CajitaMovimiento> = {}): CajitaMovimiento => ({
  id: 'm1',
  cajitaId: 'd1',
  kind: 'compra',
  deltaCop: 200_000,
  categoria: null,
  occurredOn: '2026-08-05',
  nota: '',
  createdAt: '2026-08-05T00:00:00.000Z',
  ...over,
});

const montar = (props: Partial<React.ComponentProps<typeof DeudasView>> = {}) => {
  const onCrear = vi.fn();
  const onFijarSaldo = vi.fn();
  const onMovimiento = vi.fn();
  const onEliminar = vi.fn();
  const onAbonar = vi.fn();

  render(
    <DeudasView
      cajitas={[caj()]}
      movimientos={[mov()]}
      onCrear={onCrear}
      onFijarSaldo={onFijarSaldo}
      onMovimiento={onMovimiento}
      onEliminar={onEliminar}
      cuentas={[{ id: 'nequi', nombre: 'Nequi' }]}
      onAbonar={onAbonar}
      {...props}
    />,
  );

  return { onCrear, onFijarSaldo, onMovimiento, onEliminar, onAbonar };
};

describe('DeudasView', () => {
  it('shows what is owed as a positive figure', () => {
    montar();

    // "You owe 200.000", never "-200.000": the sign lives in the wording.
    // The figure repeats (header total, card, history row), so assert on the
    // absence of a minus rather than on a single node.
    expect(screen.getAllByText('$200.000').length).toBeGreaterThan(0);
    expect(screen.queryByText('-$200.000')).not.toBeInTheDocument();
    expect(screen.getByText('debes')).toBeInTheDocument();
  });

  it('only counts debts and cards, never accounts or pockets', () => {
    montar({
      cajitas: [caj(), caj({ id: 'c1', nombre: 'Ahorros', tipo: 'cuenta' })],
      movimientos: [mov(), mov({ id: 'm2', cajitaId: 'c1', deltaCop: 5_000_000 })],
    });

    expect(screen.queryByText('Ahorros')).not.toBeInTheDocument();
    expect(screen.queryByText('$5.000.000')).not.toBeInTheDocument();
  });

  it('a purchase RAISES what you owe', () => {
    const { onMovimiento } = montar();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }));
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    // Positive delta — this is the inverted half of the shared structure, and
    // getting the sign backwards would quietly reduce the debt on every charge.
    expect(onMovimiento).toHaveBeenCalledWith('d1', 'compra', 50000, 'otros');
  });

  it('a payment LOWERS what you owe, and comes out of a real account', () => {
    const { onAbonar } = montar();

    fireEvent.click(screen.getByRole('button', { name: 'Abonar' }));
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '30000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onAbonar).toHaveBeenCalledWith({
      deudaId: 'd1',
      cuentaId: 'nequi',
      montoCop: 30000,
    });
  });

  it('a purchase still goes through the plain movement path', () => {
    // Only payments move money out of an account. A purchase raises what is
    // owed without anything leaving a balance — that is what buying on credit is.
    const { onMovimiento, onAbonar } = montar();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }));
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '30000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onMovimiento).toHaveBeenCalledWith('d1', 'compra', 30000, 'otros');
    expect(onAbonar).not.toHaveBeenCalled();
  });

  it('asks where the payment comes from', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: 'Abonar' }));

    expect(screen.getByLabelText('¿De dónde sale el pago?')).toBeInTheDocument();
  });

  it('will not let a payment be saved when there is no account to pay from', () => {
    // Money has to leave somewhere. Without an account the balances silently
    // stop adding up, which is the whole reason this is required.
    const { onAbonar } = montar({ cuentas: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Abonar' }));
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '30000' } });

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onAbonar).not.toHaveBeenCalled();
  });

  it('asks what a purchase was for, but not a payment', () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }));
    expect(screen.getByText('¿En qué fue?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abonar' }));
    // Settling what was already spent is not spending on anything.
    expect(screen.queryByText('¿En qué fue?')).not.toBeInTheDocument();
  });

  it('records the chosen category with the purchase', () => {
    const { onMovimiento } = montar();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar compra' }));
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '40000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mercado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onMovimiento).toHaveBeenCalledWith('d1', 'compra', 40000, 'mercado');
  });

  it('creates a card with its opening balance', () => {
    const { onCrear } = montar({ cajitas: [], movimientos: [] });

    fireEvent.click(screen.getByRole('button', { name: /Nueva deuda o tarjeta/ }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Amex' } });
    fireEvent.change(screen.getByLabelText('¿Cuánto debes ahora?'), {
      target: { value: '1200000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));

    expect(onCrear).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Amex', tipo: 'tarjeta', saldoInicialCop: 1200000 }),
    );
  });

  it('shows the empty state when nothing is owed', () => {
    montar({ cajitas: [], movimientos: [] });

    expect(screen.getByText('No debes nada registrado.')).toBeInTheDocument();
  });

  it('labels a charge by what it was for, not by its kind', () => {
    montar({ movimientos: [mov({ categoria: 'comida' })] });

    const historial = screen.getByText('Comida');
    expect(historial).toBeInTheDocument();
  });

  it('asks before deleting, and only deletes on confirmation', () => {
    const { onEliminar } = montar();

    fireEvent.click(screen.getByRole('button', { name: /Eliminar Visa Davivienda/ }));
    expect(onEliminar).not.toHaveBeenCalled();

    const aviso = screen.getByText(/Se elimina y con ella todo su historial/);
    fireEvent.click(within(aviso.parentElement!).getByRole('button', { name: 'Eliminar' }));

    expect(onEliminar).toHaveBeenCalledWith('d1');
  });
});
