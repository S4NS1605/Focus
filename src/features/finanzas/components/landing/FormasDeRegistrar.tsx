import React from 'react';
import {
  Camera,
  FileText,
  Keyboard,
  Mic,
  Repeat,
  Sparkles,
  type LucideIcon
} from 'lucide-react';
import { Reveal } from './primitivas';
import { TituloPalabras } from './adornos';

const FORMAS: {
  Icono: LucideIcon;
  titulo: string;
  texto: string;
  ejemplo: string;
}[] = [
  {
    Icono: Mic,
    titulo: 'Hablando',
    texto: 'Mantén el botón y cuenta el gasto en voz alta. Se transcribe y se registra.',
    ejemplo: '«cuarenta mil en el almuerzo»'
  },
  {
    Icono: Keyboard,
    titulo: 'Escribiendo',
    texto: 'Una línea corta, como si le mandaras un mensaje a alguien. Sin formularios.',
    ejemplo: 'rappi 28 mil'
  },
  {
    Icono: Camera,
    titulo: 'Con una foto',
    texto: 'Tómale foto al recibo. Lee el monto y la fecha del papel.',
    ejemplo: 'Recibo → gasto'
  },
  {
    Icono: FileText,
    titulo: 'Del extracto del banco',
    texto: 'Sube el PDF de Davivienda, Bancolombia, Nequi o Nu y entra el mes completo.',
    ejemplo: 'PDF → 84 movimientos'
  },
  {
    Icono: Repeat,
    titulo: 'Solo, cada mes',
    texto: 'Lo que se repite se declara una vez y aparece en su fecha.',
    ejemplo: 'Arriendo, el 1'
  },
  {
    Icono: Sparkles,
    titulo: 'A mano, si prefieres',
    texto: 'Teclado numérico, categoría y listo. Sin adivinanzas de por medio.',
    ejemplo: 'Control total'
  }
];

export const FormasDeRegistrar: React.FC = () => (
  <section className="formas" id="formas">
    <Reveal as="header" className="seccion-cabecera">
      <span className="seccion-etiqueta">Seis maneras</span>
      <TituloPalabras texto="Registra como te quede cómodo" resaltarUltimas={1} />
      <p className="seccion-sub">
        La app que usas es la que no te estorba. Si una forma no te sirve un día,
        hay otras cinco.
      </p>
    </Reveal>

    <div className="formas-grid">
      {FORMAS.map(({ Icono, titulo, texto, ejemplo }, i) => (
        <Reveal as="article" className="forma" key={titulo} delay={i * 0.06}>
          <span className="forma-icono">
            <Icono size={19} strokeWidth={1.5} aria-hidden />
          </span>
          <h3>{titulo}</h3>
          <p>{texto}</p>
          <span className="forma-ejemplo">{ejemplo}</span>
        </Reveal>
      ))}
    </div>
  </section>
);
