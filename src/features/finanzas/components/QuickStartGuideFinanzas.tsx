import React from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Landmark,
  FileText,
  PenLine,
  BarChart3,
  Pencil,
  Tags,
  Lock,
  Zap,
  ArrowUpRight,
  type LucideIcon
} from 'lucide-react';

/* Onboarding de Finanzas — bento asimétrico.
   El paso 1 ocupa el doble porque es el único que bloquea: sin una cuenta
   creada, los otros tres no tienen dónde escribir. */

type Paso = {
  id: string;
  titulo: string;
  descripcion: string;
  detalle: string;
  Icono: LucideIcon;
  /* Solo el paso destacado; el resto cae en una celda 1x1. */
  destacado?: boolean;
  etiqueta?: string;
};

const PASOS: Paso[] = [
  {
    id: 'cuenta',
    titulo: 'Agrega tu primera cuenta',
    descripcion: 'Débito, crédito, efectivo — donde esté tu plata.',
    detalle:
      'Dale un nombre (ej: "Davivienda débito"), elige el tipo y el saldo inicial. Si no sabes el saldo exacto, Lukapp te lo pedirá después.',
    Icono: Landmark,
    destacado: true
  },
  {
    id: 'extracto',
    titulo: 'Importa tu extracto',
    descripcion: 'Davivienda, Nequi, Bancolombia o Nu.',
    detalle: 'Sube el PDF y se leen las transacciones. No duplica lo ya importado.',
    Icono: FileText,
    etiqueta: 'Opcional'
  },
  {
    id: 'gasto',
    titulo: 'Registra un gasto hablando',
    descripcion: '"gasté 45k en almuerzo" o "Rappi 28 mil".',
    detalle: 'Escribe como hablas. Se entiende el monto, la categoría y qué fue.',
    Icono: PenLine
  },
  {
    id: 'reporte',
    titulo: 'Abre tu primer reporte',
    descripcion: 'Dónde fue tu plata esta semana, mes o año.',
    detalle: 'Gráficos por categoría y tendencias. Sin juzgar, solo números.',
    Icono: BarChart3
  }
];

const CONSEJOS: { Icono: LucideIcon; texto: string }[] = [
  { Icono: Pencil, texto: 'Todo gasto se puede editar después' },
  { Icono: Tags, texto: 'Crea tus propias categorías' },
  { Icono: Lock, texto: 'Los datos son tuyos, todo es local' },
  { Icono: Zap, texto: 'El análisis es automático' }
];

const TarjetaPaso: React.FC<{ paso: Paso; indice: number }> = ({ paso, indice }) => {
  const { titulo, descripcion, detalle, Icono, destacado, etiqueta } = paso;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: indice * 0.05, ease: [0.32, 0.72, 0, 1] }}
      whileHover={{ y: -2 }}
      className={[
        'group relative flex flex-col rounded-xl border border-zinc-800/50 bg-zinc-900',
        'p-5 transition-colors duration-200 hover:border-zinc-700',
        destacado ? 'md:col-span-2 md:row-span-2 md:p-7' : ''
      ].join(' ')}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <Icono
          className={destacado ? 'text-emerald-400/90' : 'text-zinc-500'}
          size={destacado ? 22 : 18}
          strokeWidth={1.5}
          aria-hidden
        />
        <div className="flex items-center gap-2">
          {etiqueta && (
            <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {etiqueta}
            </span>
          )}
          <span className="font-mono text-xs tabular-nums text-zinc-600">
            {String(indice + 1).padStart(2, '0')}
          </span>
        </div>
      </div>

      <h4
        className={[
          'font-medium tracking-tight text-zinc-100',
          destacado ? 'text-xl' : 'text-[15px]'
        ].join(' ')}
      >
        {titulo}
      </h4>

      <p className={['mt-1.5 text-zinc-400', destacado ? 'text-sm' : 'text-[13px]'].join(' ')}>
        {descripcion}
      </p>

      <p
        className={[
          'mt-auto pt-4 leading-relaxed text-zinc-500',
          destacado ? 'text-sm' : 'text-[12.5px]'
        ].join(' ')}
      >
        {detalle}
      </p>

      {destacado && (
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition-colors group-hover:text-white">
          Empieza por aquí
          <ArrowUpRight
            size={15}
            strokeWidth={1.75}
            className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        </span>
      )}
    </motion.article>
  );
};

export const QuickStartGuideFinanzas: React.FC<{
  onDismiss?: () => void;
}> = ({ onDismiss }) => (
  <section
    aria-label="Primeros pasos"
    className="mb-6 rounded-2xl border border-zinc-800/50 bg-zinc-950 p-6 md:p-8"
  >
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-lg font-medium tracking-tight text-zinc-100">Primeros pasos</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Cuatro cosas para tener tu dinero bajo control
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar guía"
          className="-m-1 rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-600"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      )}
    </header>

    <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:auto-rows-fr">
      {PASOS.map((paso, i) => (
        <TarjetaPaso key={paso.id} paso={paso} indice={i} />
      ))}
    </div>

    <footer className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-zinc-800/50 pt-4">
      {CONSEJOS.map(({ Icono, texto }) => (
        <span key={texto} className="flex items-center gap-1.5 text-xs text-zinc-500/80">
          <Icono size={13} strokeWidth={1.5} className="text-zinc-600" aria-hidden />
          {texto}
        </span>
      ))}
    </footer>
  </section>
);
