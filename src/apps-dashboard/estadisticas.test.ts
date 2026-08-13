import { describe, expect, it } from 'vitest';
import type { Visita } from './estadisticas';
import { banderaDePais, diasHasta, nombreDePais, resumir } from './estadisticas';

const visita = (over: Partial<Visita> = {}): Visita => ({
  ruta: '/',
  referente: null,
  pais: 'CO',
  dispositivo: 'escritorio',
  visitante: 'aaa',
  creado_en: '2026-08-13T15:00:00Z',
  ...over,
});

describe('diasHasta', () => {
  it('devuelve los días en Bogotá, del más viejo al más nuevo', () => {
    expect(diasHasta(new Date('2026-08-13T15:00:00Z'), 3)).toEqual([
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
    ]);
  });

  it('usa el día de acá y no el de UTC', () => {
    // 02:00 UTC del 14 son las 21:00 del 13 en Bogotá.
    expect(diasHasta(new Date('2026-08-14T02:00:00Z'), 1)).toEqual(['2026-08-13']);
  });
});

describe('resumir', () => {
  const DIAS = ['2026-08-12', '2026-08-13'];

  it('cuenta vistas y visitantes distintos por día', () => {
    const r = resumir(
      [
        visita({ visitante: 'ana', creado_en: '2026-08-13T15:00:00Z' }),
        visita({ visitante: 'ana', creado_en: '2026-08-13T16:00:00Z' }),
        visita({ visitante: 'beto', creado_en: '2026-08-13T17:00:00Z' }),
      ],
      DIAS,
    );

    expect(r.vistas).toBe(3);
    expect(r.visitantes).toBe(2);
  });

  it('muestra los días sin visitas como cero', () => {
    // Si el día vacío desapareciera, la gráfica diría que el tráfico fue parejo.
    const r = resumir([visita({ creado_en: '2026-08-13T15:00:00Z' })], DIAS);

    expect(r.porDia).toEqual([
      { fecha: '2026-08-12', vistas: 0, visitantes: 0 },
      { fecha: '2026-08-13', vistas: 1, visitantes: 1 },
    ]);
  });

  it('suma los visitantes de cada día, sin cruzarlos entre días', () => {
    // La misma huella dos días es coincidencia, no una persona: el hash rota a
    // medianoche justo para que no se pueda saber. Cuenta como dos.
    const r = resumir(
      [
        visita({ visitante: 'igual', creado_en: '2026-08-12T15:00:00Z' }),
        visita({ visitante: 'igual', creado_en: '2026-08-13T15:00:00Z' }),
      ],
      DIAS,
    );

    expect(r.visitantes).toBe(2);
  });

  it('ignora lo que cae fuera del rango', () => {
    const r = resumir([visita({ creado_en: '2026-07-01T15:00:00Z' })], DIAS);

    expect(r.vistas).toBe(0);
    expect(r.rutas).toEqual([]);
  });

  it('agrupa rutas, países y dispositivos de más a menos', () => {
    const r = resumir(
      [
        visita({ ruta: '/', pais: 'CO', dispositivo: 'movil' }),
        visita({ ruta: '/', pais: 'US', dispositivo: 'movil' }),
        visita({ ruta: '/proyectos', pais: 'CO', dispositivo: 'escritorio' }),
      ],
      DIAS,
    );

    expect(r.rutas).toEqual([
      { clave: '/', n: 2 },
      { clave: '/proyectos', n: 1 },
    ]);
    expect(r.paises[0]).toEqual({ clave: 'CO', n: 2 });
    expect(r.dispositivos[0]).toEqual({ clave: 'movil', n: 2 });
  });

  it('cuenta como "directo" al que llegó sin referente', () => {
    const r = resumir(
      [
        visita({ referente: null }),
        visita({ referente: 'linkedin.com' }),
        visita({ referente: null }),
      ],
      DIAS,
    );

    expect(r.referentes).toEqual([
      { clave: 'directo', n: 2 },
      { clave: 'linkedin.com', n: 1 },
    ]);
  });

  it('desempata alfabéticamente para que el orden no baile entre recargas', () => {
    const r = resumir(
      [visita({ ruta: '/zeta' }), visita({ ruta: '/alfa' })],
      DIAS,
    );

    expect(r.rutas.map((x) => x.clave)).toEqual(['/alfa', '/zeta']);
  });
});

describe('nombreDePais y banderaDePais', () => {
  it('traduce los códigos que van a aparecer', () => {
    expect(nombreDePais('CO')).toBe('Colombia');
    expect(nombreDePais('XX')).toBe('Sin determinar');
  });

  it('deja pasar un código que no está en la lista', () => {
    expect(nombreDePais('JP')).toBe('JP');
  });

  it('arma la bandera desde el código', () => {
    expect(banderaDePais('CO')).toBe('🇨🇴');
    expect(banderaDePais('US')).toBe('🇺🇸');
  });

  it('usa un globo cuando no hay país', () => {
    expect(banderaDePais('XX')).toBe('🌐');
  });
});
