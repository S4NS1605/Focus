import React from 'react';

/**
 * La barra de estado del teléfono de la portada: hora, cobertura, wifi y
 * batería, repartidas a lado y lado de la isla dinámica.
 *
 * Los tres iconos van dibujados aquí y no salen de lucide a propósito. Los de
 * la librería son de trazo uniforme —el mismo lápiz para todo— y al lado de un
 * marco de titanio con isla dinámica se leen como un icono genérico pegado
 * encima. Los de un teléfono de verdad no son así: las barras de cobertura son
 * macizas y de esquina redonda, el wifi es un abanico de arcos con la punta
 * rellena, y la batería es un contorno tenue con la carga sólida por dentro y
 * el pezón al lado. Esa diferencia es justo la que decide si el mockup se lee
 * como un aparato o como un dibujo de un aparato.
 *
 * Todos heredan `currentColor`, así que la barra sigue el tema de la landing
 * sin una sola regla de color propia.
 */

/** "9:41", "14:09". A mano y no con `toLocaleTimeString`: el formato de es-CO
 *  es de 12 horas y devuelve "2:09 p. m.", que es casi el doble de ancho y
 *  desbordaría la oreja izquierda de la pantalla. */
export const horaDe = (d: Date): string => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

/** La hora que enseña el mockup, fija. No la hora real del visitante: un
 * screenshot de marketing no necesita reloj en vivo, y "11:11" es simétrica
 * y se lee bien en la barra sin robarle atención a la isla dinámica. */
const HORA_MOCKUP = '11:11';

const IconoCobertura: React.FC = () => (
  <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden>
    {[0, 1, 2, 3].map((i) => {
      const alto = 3.6 + i * 2.5;
      return (
        <rect
          key={i}
          x={i * 4.55}
          y={12 - alto}
          width="3.1"
          height={alto}
          rx="1.05"
          fill="currentColor"
          fillOpacity={i === 3 ? 0.32 : 1}
        />
      );
    })}
  </svg>
);

const IconoWifi: React.FC = () => (
  <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
    <path d="M1.15 3.5a9.7 9.7 0 0 1 13.7 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M3.85 6.5a5.9 5.9 0 0 1 8.3 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M8 11.2 5.85 9.05a3.04 3.04 0 0 1 4.3 0L8 11.2Z" fill="currentColor" />
  </svg>
);

/** `nivel` va de 0 a 1 y solo mueve el ancho de la carga. */
const IconoBateria: React.FC<{ nivel: number }> = ({ nivel }) => (
  <svg width="27" height="13" viewBox="0 0 27 13" fill="none" aria-hidden>
    <rect
      x="0.6"
      y="0.6"
      width="22.6"
      height="11.8"
      rx="3.7"
      stroke="currentColor"
      strokeOpacity="0.34"
      strokeWidth="1.2"
    />
    <path d="M25.1 4.7a2.7 2.7 0 0 1 0 3.6V4.7Z" fill="currentColor" fillOpacity="0.34" />
    <rect x="2.2" y="2.2" width={19.4 * nivel} height="8.6" rx="2.3" fill="currentColor" />
  </svg>
);

const NIVEL_BATERIA = 0.86;

export const BarraEstado: React.FC = () => {
  return (
    <div className="barra-estado">
      <span className="estado-hora">{HORA_MOCKUP}</span>
      <span className="estado-iconos">
        <IconoCobertura />
        <IconoWifi />
        <IconoBateria nivel={NIVEL_BATERIA} />
      </span>
    </div>
  );
};
