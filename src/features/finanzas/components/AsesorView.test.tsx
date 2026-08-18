import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AsesorView } from './AsesorView';
import { LEXICO_VACIO } from '../lib/aprendizaje';

// El chat solo necesita saber si hay un modelo detrás; nada más de la app.
const props = {
  transacciones: [],
  cajitas: [],
  cajitasBalances: {},
  categorias: [],
  lexico: LEXICO_VACIO,
};

const responder = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body } as Response);

describe('AsesorView — estado de conexión', () => {
  beforeEach(() => {
    // jsdom no implementa scrollIntoView y el chat lo usa para bajar al último
    // mensaje. Es una carencia del entorno de prueba, no del componente.
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', responder({ ok: true, ia: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('arranca diciendo que está conectando, no que hay IA', async () => {
    // Importa: mientras no se sepa, no se puede prometer "En línea". En el plan
    // gratuito de Render despertar el servicio tarda hasta ~40 s.
    render(<AsesorView {...props} />);
    expect(screen.getByText('Conectando…')).toBeTruthy();
  });

  it('pasa a "En línea" cuando el servidor reporta que hay IA', async () => {
    render(<AsesorView {...props} />);
    await waitFor(() => expect(screen.getByText('En línea')).toBeTruthy());
  });

  it('dice "modo local" cuando el servidor responde que no hay IA', async () => {
    vi.stubGlobal('fetch', responder({ ok: true, ia: false }));
    render(<AsesorView {...props} />);
    await waitFor(() => expect(screen.getByText(/modo local/)).toBeTruthy());
  });

  it('dice "modo local" si el servidor no responde en absoluto', async () => {
    // Sin servidor no hay IA, pero el motor de reglas sigue contestando: el
    // encabezado tiene que reflejar eso en vez de quedarse en "Conectando…".
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));
    render(<AsesorView {...props} />);
    await waitFor(() => expect(screen.getByText(/modo local/)).toBeTruthy());
  });

  it('nunca anuncia "En línea" si el servidor dice que no hay IA', async () => {
    vi.stubGlobal('fetch', responder({ ok: true, ia: false }));
    render(<AsesorView {...props} />);
    await waitFor(() => expect(screen.getByText(/modo local/)).toBeTruthy());
    expect(screen.queryByText('En línea')).toBeNull();
  });
});
