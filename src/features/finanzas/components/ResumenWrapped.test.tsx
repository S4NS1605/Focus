import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResumenWrapped } from './ResumenWrapped';
import type { TarjetaResumen } from '../lib/resumenMes';

// El toque avanza o retrocede según a qué tercio de la pantalla cayó, y eso se
// calcula con el ancho real del área — que jsdom no mide (todo `getBoundingClientRect`
// da 0 por defecto). Se fija un ancho falso de 400px para poder simular "toqué a
// la izquierda" vs. "toqué a la derecha" con coordenadas concretas.
beforeEach(() => {
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    width: 400,
    top: 0,
    height: 600,
    right: 400,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => {},
  }));
});

const TARJETAS: TarjetaResumen[] = [
  { tipo: 'portada', mes: '2026-08' },
  {
    tipo: 'balance',
    totals: { ingresos: 1_000_000, gastos: 300_000, balance: 700_000, tasaAhorro: 70 },
  },
  {
    tipo: 'cierre',
    totals: { ingresos: 1_000_000, gastos: 300_000, balance: 700_000, tasaAhorro: 70 },
    tono: 'bien',
    frase: 'Guardaste una buena tajada este mes.',
  },
];

/**
 * Monta el resumen y devuelve el área que escucha el toque — el SEGUNDO hijo
 * del diálogo, entre el encabezado (barra de progreso + cerrar) y el pie que
 * solo aparece en la última tarjeta. No es el diálogo entero: `onClick` vive
 * ahí, y un clic disparado en un ancestro no baja a un hijo, así que probar
 * contra el diálogo completo nunca ejercitaría el manejador de verdad.
 */
const montar = (onCerrar: () => void = () => {}) => {
  render(<ResumenWrapped tarjetas={TARJETAS} onCerrar={onCerrar} />);
  const dialogo = screen.getByRole('dialog', { name: 'Tu resumen del mes' });
  const area = dialogo.children[1] as HTMLElement;
  return { dialogo, area };
};

// AnimatePresence espera a que la tarjeta saliente termine de animarse antes
// de montar la entrante (`mode="wait"`), y esa animación corre sobre
// requestAnimationFrame de verdad. Sin esta espera, la aserción de después del
// toque sigue viendo la tarjeta vieja a mitad de salida.
const esperarTransicion = () => new Promise((resolve) => setTimeout(resolve, 250));

const toqueDerecha = async (area: HTMLElement) => {
  fireEvent.click(area, { clientX: 350 });
  await esperarTransicion();
};
const toqueIzquierda = async (area: HTMLElement) => {
  fireEvent.click(area, { clientX: 40 });
  await esperarTransicion();
};

describe('ResumenWrapped — navegación por toque', () => {
  it('empieza en la portada, con el mes pedido', () => {
    montar();
    expect(screen.getByText(/agosto 2026/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Tarjeta 1 de 3')).toBeInTheDocument();
  });

  it('tocar el lado derecho avanza a la siguiente tarjeta', async () => {
    const { area } = montar();
    await toqueDerecha(area);
    expect(screen.getByLabelText('Tarjeta 2 de 3')).toBeInTheDocument();
    expect(screen.getByText('$700.000')).toBeInTheDocument();
  });

  it('tocar el lado izquierdo en la primera tarjeta se queda ahí, no retrocede de más', async () => {
    const { area } = montar();
    await toqueIzquierda(area);
    expect(screen.getByLabelText('Tarjeta 1 de 3')).toBeInTheDocument();
  });

  it('avanzar y luego tocar la izquierda regresa a la tarjeta anterior', async () => {
    const { area } = montar();
    await toqueDerecha(area);
    expect(screen.getByLabelText('Tarjeta 2 de 3')).toBeInTheDocument();
    await toqueIzquierda(area);
    expect(screen.getByLabelText('Tarjeta 1 de 3')).toBeInTheDocument();
  });

  it('avanzar más allá de la última tarjeta se queda en la última', async () => {
    const { area } = montar();
    await toqueDerecha(area);
    await toqueDerecha(area);
    await toqueDerecha(area);
    await toqueDerecha(area);
    expect(screen.getByLabelText('Tarjeta 3 de 3')).toBeInTheDocument();
  });
});

describe('ResumenWrapped — el cierre', () => {
  const irAlCierre = async () => {
    const { area } = montar();
    await toqueDerecha(area);
    await toqueDerecha(area);
  };

  it('solo la última tarjeta trae los botones de Compartir y Cerrar', async () => {
    const { area } = montar();
    expect(screen.queryByRole('button', { name: /Compartir/ })).not.toBeInTheDocument();

    await toqueDerecha(area);
    await toqueDerecha(area);
    expect(screen.getByRole('button', { name: /Compartir/ })).toBeInTheDocument();
  });

  it('el botón Cerrar de la última tarjeta llama a onCerrar', async () => {
    const onCerrar = vi.fn();
    const { area } = montar(onCerrar);
    await toqueDerecha(area);
    await toqueDerecha(area);
    // Hay dos botones "Cerrar" en esta tarjeta: la X del encabezado y el del
    // pie. El del pie es el segundo en el orden del documento.
    const botones = screen.getAllByRole('button', { name: 'Cerrar' });
    fireEvent.click(botones[botones.length - 1]);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('el botón X del encabezado cierra desde cualquier tarjeta', () => {
    const onCerrar = vi.fn();
    montar(onCerrar);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('compartir copia un resumen en texto cuando no hay Web Share API', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribir },
      configurable: true,
    });
    // jsdom no trae navigator.share; nos aseguramos de que así sea para este caso.
    // @ts-expect-error -- borrando una API que jsdom no define de por sí
    delete navigator.share;

    await irAlCierre();
    fireEvent.click(screen.getByRole('button', { name: /Compartir/ }));

    await screen.findByText('Copiado');
    expect(escribir).toHaveBeenCalledTimes(1);
    expect(escribir.mock.calls[0][0]).toContain('agosto 2026');
  });

  it('compartir usa la Web Share API cuando está disponible, sin tocar el portapapeles', async () => {
    const compartir = vi.fn().mockResolvedValue(undefined);
    const escribir = vi.fn();
    Object.defineProperty(navigator, 'share', { value: compartir, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribir },
      configurable: true,
    });

    await irAlCierre();
    fireEvent.click(screen.getByRole('button', { name: /Compartir/ }));

    await vi.waitFor(() => expect(compartir).toHaveBeenCalledTimes(1));
    expect(escribir).not.toHaveBeenCalled();

    // @ts-expect-error -- limpiar para no filtrar el stub a otros tests
    delete navigator.share;
  });
});

describe('ResumenWrapped — teclado', () => {
  it('flecha derecha avanza, flecha izquierda retrocede, Escape cierra', () => {
    const onCerrar = vi.fn();
    const { dialogo } = montar(onCerrar);

    fireEvent.keyDown(dialogo, { key: 'ArrowRight' });
    expect(screen.getByLabelText('Tarjeta 2 de 3')).toBeInTheDocument();

    fireEvent.keyDown(dialogo, { key: 'ArrowLeft' });
    expect(screen.getByLabelText('Tarjeta 1 de 3')).toBeInTheDocument();

    fireEvent.keyDown(dialogo, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });
});
