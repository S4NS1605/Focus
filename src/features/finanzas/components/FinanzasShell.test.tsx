import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { FinanzasShell } from './FinanzasShell';
import { SECTIONS, OCULTAS_EN_SIDEBAR_ESCRITORIO } from '../sections';

const props = {
  section: 'resumen' as const,
  onSectionChange: vi.fn(),
  children: <div>contenido</div>,
};

describe('FinanzasShell — sidebar de escritorio', () => {
  it('esconde Contactos y Tendencias del sidebar', () => {
    render(<FinanzasShell {...props} />);
    // Hay dos <nav aria-label="Secciones">: el sidebar de escritorio (primero
    // en el DOM) y la barra inferior de celular (después) -- CSS decide cuál
    // se ve, pero testing-library ve ambos árboles siempre montados.
    const [aside] = screen.getAllByRole('navigation', { name: 'Secciones' });
    expect(within(aside).queryByText('Contactos')).toBeNull();
    expect(within(aside).queryByText('Tendencias')).toBeNull();
  });

  it('sigue mostrando el resto de las secciones en el sidebar', () => {
    render(<FinanzasShell {...props} />);
    const [aside] = screen.getAllByRole('navigation', { name: 'Secciones' });
    for (const item of SECTIONS) {
      if (OCULTAS_EN_SIDEBAR_ESCRITORIO.includes(item.id)) continue;
      expect(within(aside).getByText(item.label)).toBeTruthy();
    }
  });
});
