import { describe, it, expect } from 'vitest';
import {
  asesorEnHorario,
  bogotaDate,
  bogotaHora,
  dayLabel,
  monthKey,
  monthKeyLabel,
  monthLabel,
  shiftDays,
  shiftMonth,
} from './localDate';

// Bogota is UTC-5 year round (no DST), so these boundaries are stable.
describe('bogotaDate', () => {
  it('uses the Bogota day, not the UTC day, late in the evening', () => {
    // 02:00 UTC is still 21:00 the previous day in Bogota.
    expect(bogotaDate(new Date('2026-07-29T02:00:00Z'))).toBe('2026-07-28');
  });

  it('keeps the same day during Bogota daytime', () => {
    expect(bogotaDate(new Date('2026-07-29T18:00:00Z'))).toBe('2026-07-29');
  });

  it('rolls over exactly at Bogota midnight', () => {
    expect(bogotaDate(new Date('2026-07-30T04:59:00Z'))).toBe('2026-07-29');
    expect(bogotaDate(new Date('2026-07-30T05:00:00Z'))).toBe('2026-07-30');
  });
});

describe('shiftDays', () => {
  it('steps back and forward', () => {
    expect(shiftDays('2026-07-29', -1)).toBe('2026-07-28');
    expect(shiftDays('2026-07-29', 1)).toBe('2026-07-30');
  });

  it('crosses month and year boundaries', () => {
    expect(shiftDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(shiftDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(shiftDays('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('dayLabel', () => {
  it('names today and yesterday', () => {
    expect(dayLabel('2026-07-29', '2026-07-29')).toBe('Hoy');
    expect(dayLabel('2026-07-28', '2026-07-29')).toBe('Ayer');
  });

  it('falls back to a short date', () => {
    expect(dayLabel('2026-07-20', '2026-07-29')).toBe('20 jul');
    expect(dayLabel('2026-01-05', '2026-07-29')).toBe('5 ene');
  });
});

describe('shiftMonth', () => {
  it('steps within a year', () => {
    expect(shiftMonth('2026-07', -1)).toBe('2026-06');
    expect(shiftMonth('2026-07', 1)).toBe('2026-08');
  });

  it('rolls the year over in both directions', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('handles multi-year jumps', () => {
    expect(shiftMonth('2026-07', -12)).toBe('2025-07');
    expect(shiftMonth('2026-07', 18)).toBe('2028-01');
  });

  it('is its own inverse', () => {
    for (const month of ['2026-01', '2026-07', '2026-12']) {
      expect(shiftMonth(shiftMonth(month, 5), -5)).toBe(month);
    }
  });
});

describe('monthKeyLabel', () => {
  it('renders a month key in Spanish', () => {
    expect(monthKeyLabel('2026-07')).toBe('julio 2026');
    expect(monthKeyLabel('2026-01')).toBe('enero 2026');
  });
});

describe('monthLabel / monthKey', () => {
  it('renders the month in Spanish', () => {
    expect(monthLabel('2026-07-29')).toBe('julio 2026');
    expect(monthLabel('2026-12-01')).toBe('diciembre 2026');
  });

  it('keys by year and month', () => {
    expect(monthKey('2026-07-29')).toBe('2026-07');
  });
});

describe('asesorEnHorario', () => {
  // Colombia es UTC-5 fijo, sin horario de verano.
  it('7 a. m. en Bogotá ya es horario (límite inferior incluido)', () => {
    expect(asesorEnHorario(new Date('2026-08-18T12:00:00Z'))).toBe(true);
  });

  it('9 p. m. todavía es horario (límite superior incluido)', () => {
    expect(asesorEnHorario(new Date('2026-08-19T02:00:00Z'))).toBe(true);
  });

  it('6:59 a. m. aún no', () => {
    expect(asesorEnHorario(new Date('2026-08-18T11:59:00Z'))).toBe(false);
  });

  it('10 p. m. ya no', () => {
    expect(asesorEnHorario(new Date('2026-08-19T03:00:00Z'))).toBe(false);
  });

  it('la medianoche de Bogotá cuenta como fuera de horario', () => {
    // Caso de borde real: hour12:false devuelve '24' en algunos entornos y sin
    // el módulo 24 la medianoche se leería como hora 24 y rompería la comparación.
    expect(bogotaHora(new Date('2026-08-19T05:00:00Z'))).toBe(0);
    expect(asesorEnHorario(new Date('2026-08-19T05:00:00Z'))).toBe(false);
  });
});
