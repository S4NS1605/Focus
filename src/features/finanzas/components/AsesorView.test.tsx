import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AsesorView, etiquetaConexion } from './AsesorView';
import { LEXICO_VACIO } from '../lib/aprendizaje';
import * as supabaseData from '../data/supabase';

// 15:00 UTC = 10 a. m. en Bogotá (dentro del horario); 06:00 UTC = 1 a. m. (fuera).
const enHorario = new Date('2026-08-18T15:00:00Z');
const deMadrugada = new Date('2026-08-18T06:00:00Z');

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

describe('AsesorView — el LLM nunca decide solo qué se guarda', () => {
  // Simula una sesión real: sin esto, handleSend nunca intenta llamar al LLM
  // y cae directo al motor local (que ya se prueba aparte en asesorBot.test.ts).
  const sesionFalsa = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok-123' } } }),
    },
  };

  const fetchPorRuta = (respuestaAsesor: unknown) =>
    vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/api/salud')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true, ia: true }) });
      }
      if (String(url).includes('/api/asesor-ia')) {
        return Promise.resolve({ ok: true, json: async () => respuestaAsesor });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(supabaseData, 'obtenerSupabase').mockReturnValue(sesionFalsa as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('muestra el botón de confirmar cuando lo dictado sí describe un gasto real', async () => {
    vi.stubGlobal(
      'fetch',
      fetchPorRuta({ offline: false, text: 'Listo, registrado.', provider: 'Groq (GPT-OSS 120B)' }),
    );
    render(<AsesorView {...props} onCrearTransaccion={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('En línea')).toBeTruthy());

    const input = screen.getByPlaceholderText('Pregúntale a tu asesor...');
    fireEvent.change(input, { target: { value: 'me compre un pancito, me costo 2500' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.getByText(/sí, registrar gasto/i)).toBeTruthy());
  });

  it('NO muestra botón de confirmar si el modelo responde pero no había ningún monto que registrar', async () => {
    // Este es exactamente el caso que se vio en producción: el modelo puede
    // "sonar" como si hubiera anotado algo, pero si parseTransaction no
    // encuentra un monto real dictado, no hay nada que confirmar.
    vi.stubGlobal(
      'fetch',
      fetchPorRuta({
        offline: false,
        text: '¡Funcionando al 100%! Listo para ayudarte.',
        provider: 'Groq (GPT-OSS 120B)',
      }),
    );
    render(<AsesorView {...props} onCrearTransaccion={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('En línea')).toBeTruthy());

    const input = screen.getByPlaceholderText('Pregúntale a tu asesor...');
    fireEvent.change(input, { target: { value: 'como estas?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getByText('¡Funcionando al 100%! Listo para ayudarte.')).toBeTruthy(),
    );
    expect(screen.queryByText(/sí, registrar/i)).toBeNull();
  });
});

describe('etiquetaConexion — horario de servicio', () => {
  it('de día sin IA dice que no hay conexión', () => {
    expect(etiquetaConexion('local', enHorario)).toMatch(/Sin conexión/);
  });

  it('de madrugada dice que descansa, no que está caído', () => {
    // La diferencia importa: a esa hora no está roto, el ping no corre a propósito.
    const texto = etiquetaConexion('local', deMadrugada);
    expect(texto).toMatch(/Descansando/);
    expect(texto).not.toMatch(/Sin conexión/);
  });

  it('siempre aclara que el motor local sigue respondiendo', () => {
    expect(etiquetaConexion('local', enHorario)).toMatch(/modo local/);
    expect(etiquetaConexion('local', deMadrugada)).toMatch(/modo local/);
  });

  it('avisa que puede tardar si despierta fuera de horario', () => {
    expect(etiquetaConexion('despertando', enHorario)).toBe('Conectando…');
    expect(etiquetaConexion('despertando', deMadrugada)).toMatch(/puede tardar/);
  });

  it('"En línea" no depende de la hora', () => {
    expect(etiquetaConexion('en-linea', enHorario)).toBe('En línea');
    expect(etiquetaConexion('en-linea', deMadrugada)).toBe('En línea');
  });
});
