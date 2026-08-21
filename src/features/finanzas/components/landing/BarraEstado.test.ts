import { describe, it, expect } from 'vitest';
import { horaDe } from './BarraEstado';

/** Un Date en hora local, que es la que lee el reloj de la barra. */
const alas = (h: number, m: number) => new Date(2026, 7, 20, h, m);

describe('horaDe', () => {
  it('pads the minutes to two digits', () => {
    expect(horaDe(alas(9, 4))).toBe('9:04');
    expect(horaDe(alas(9, 41))).toBe('9:41');
  });

  it('leaves the hour without a leading zero, like the device does', () => {
    expect(horaDe(alas(7, 30))).toBe('7:30');
  });

  it('runs on 24 hours, so the afternoon never needs a "p. m." that would not fit', () => {
    expect(horaDe(alas(14, 9))).toBe('14:09');
    expect(horaDe(alas(23, 59))).toBe('23:59');
  });

  it('shows midnight as 0 and not as 24', () => {
    expect(horaDe(alas(0, 0))).toBe('0:00');
  });
});
