import React from 'react';
import { Braces, HardDrive, RefreshCw, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Reveal } from './primitivas';

const PUNTOS: { Icono: LucideIcon; titulo: string; texto: string }[] = [
  {
    Icono: HardDrive,
    titulo: 'Empieza sin cuenta',
    texto:
      'Tus movimientos se guardan en tu propio navegador. Puedes usar Lukapp entera sin registrarte en nada.'
  },
  {
    Icono: RefreshCw,
    titulo: 'La nube es opcional',
    texto:
      'Si quieres los mismos datos en el celular y en el computador, creas una cuenta. Si no, no.'
  },
  {
    Icono: ShieldCheck,
    titulo: 'Nada se vende',
    texto:
      'No hay anunciantes, no hay perfiles de consumo, no hay terceros mirando en qué gastas.'
  },
  {
    Icono: Braces,
    titulo: 'La matemática se puede leer',
    texto:
      'El código está publicado. Si no confías en la cifra, puedes ir a ver de dónde salió.'
  }
];

export const Privacidad: React.FC = () => (
  <section className="privacidad" id="privacidad">
    <Reveal as="header" className="seccion-cabecera">
      <span className="seccion-etiqueta">Tus datos</span>
      <h2>Tu plata no es el producto</h2>
    </Reveal>

    <div className="privacidad-grid">
      {PUNTOS.map(({ Icono, titulo, texto }, i) => (
        <Reveal as="article" className="privacidad-item" key={titulo} delay={i * 0.07}>
          <span className="privacidad-icono">
            <Icono size={18} strokeWidth={1.5} aria-hidden />
          </span>
          <h3>{titulo}</h3>
          <p>{texto}</p>
        </Reveal>
      ))}
    </div>
  </section>
);
