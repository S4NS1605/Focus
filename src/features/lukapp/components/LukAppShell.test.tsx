import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LukAppShell } from './LukAppShell';
import { SECTIONS } from '../sections';

const props = {
  section: 'inicio' as const,
  onSectionChange: vi.fn(),
  children: <div>contenido</div>,
};

/**
 * Antes había dos árboles de navegación montados a la vez —el menú lateral del
 * computador y la barra del celular— y estos tests comprobaban que cada uno
 * escondiera cosas distintas. Ahora hay uno solo, así que lo que se comprueba
 * es que esté completo y que no dependa del ancho de la pantalla.
 */
describe('LukAppShell', () => {
  it('tiene una sola barra de navegación', () => {
    render(<LukAppShell {...props} />);
    // Este es el test que impide volver atrás. Dos barras eran la causa de que
    // hubiera funciones alcanzables en un aparato y no en el otro.
    expect(screen.getAllByRole('navigation', { name: 'Secciones' })).toHaveLength(1);
  });

  it('muestra los cuatro destinos', () => {
    render(<LukAppShell {...props} />);
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    for (const item of SECTIONS) {
      expect(within(nav).getByText(item.label)).toBeTruthy();
    }
  });

  it('marca cuál es el destino actual', () => {
    render(<LukAppShell {...props} />);
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    const actual = within(nav).getAllByRole('button', { current: 'page' });
    expect(actual).toHaveLength(1);
    expect(actual[0].textContent).toContain('Inicio');
  });

  it('avisa a quién corresponda al tocar otro destino', () => {
    const onSectionChange = vi.fn();
    render(<LukAppShell {...props} onSectionChange={onSectionChange} />);
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    within(nav).getByText('Dinero').click();
    expect(onSectionChange).toHaveBeenCalledWith('dinero');
  });

  it('pinta el contenido que recibe', () => {
    render(<LukAppShell {...props} />);
    expect(screen.getByText('contenido')).toBeTruthy();
  });
});
