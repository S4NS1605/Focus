import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bot,
  PiggyBank,
  Repeat,
  Target,
  TrendingUp,
  Wallet,
  type LucideIcon
} from 'lucide-react';
import { formatCop } from '../../lib/formatCop';
import { Reveal } from './primitivas';
import { TituloPalabras } from './adornos';

/* ── Mockups ──────────────────────────────────────────────────────────────
   Cada pestaña dibuja su propia pantalla. Son SVG y CSS, no capturas: pesan
   nada, se ven nítidos en cualquier pantalla y siguen el tema claro/oscuro
   solo. */

const Barra: React.FC<{
  etiqueta: string;
  valor: number;
  tope: number;
  color: string;
  retraso: number;
}> = ({ etiqueta, valor, tope, color, retraso }) => {
  const quieto = useReducedMotion();
  const pct = Math.min((valor / tope) * 100, 100);
  const pasado = valor > tope;

  return (
    <div className="mk-barra">
      <div className="mk-barra-fila">
        <span>{etiqueta}</span>
        <span className={pasado ? 'mk-pasado' : ''}>{formatCop(valor)}</span>
      </div>
      <div className="mk-barra-riel">
        <motion.span
          className="mk-barra-lleno"
          style={{ background: color }}
          initial={quieto ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: retraso, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
};

const MockCajitas: React.FC = () => (
  <div className="mk">
    <span className="mk-titulo">Cajitas</span>
    <Barra etiqueta="Viaje a Santa Marta" valor={1850000} tope={3000000} color="#0ea5e9" retraso={0.1} />
    <Barra etiqueta="Matrícula" valor={2400000} tope={3200000} color="#8b5cf6" retraso={0.2} />
    <Barra etiqueta="Fondo de emergencia" valor={900000} tope={6000000} color="#10b981" retraso={0.3} />
    <p className="mk-nota">Apartada, la plata deja de estar disponible para el resto.</p>
  </div>
);

const MockPresupuestos: React.FC = () => (
  <div className="mk">
    <span className="mk-titulo">Presupuesto de agosto</span>
    <Barra etiqueta="Comida" valor={620000} tope={800000} color="#f59e0b" retraso={0.1} />
    <Barra etiqueta="Transporte" valor={310000} tope={400000} color="#3b82f6" retraso={0.2} />
    <Barra etiqueta="Entretenimiento" valor={280000} tope={200000} color="#ef4444" retraso={0.3} />
    <p className="mk-nota">Te avisa antes de que te pases, no después.</p>
  </div>
);

const DEUDAS = [
  { nombre: 'Visa Davivienda', saldo: 3200000, cuota: 'Corte el 15' },
  { nombre: 'Préstamo a mi mamá', saldo: 800000, cuota: 'Sin fecha' },
  { nombre: 'Celular a cuotas', saldo: 1450000, cuota: '7 de 12' }
];

const MockDeudas: React.FC = () => {
  const quieto = useReducedMotion();
  return (
    <div className="mk">
      <span className="mk-titulo">Deudas</span>
      {DEUDAS.map((d, i) => (
        <motion.div
          className="mk-fila"
          key={d.nombre}
          initial={quieto ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 + i * 0.12 }}
        >
          <div className="mk-fila-texto">
            <span className="mk-fila-nombre">{d.nombre}</span>
            <span className="mk-fila-sub">{d.cuota}</span>
          </div>
          <span className="mk-fila-monto out">{formatCop(d.saldo)}</span>
        </motion.div>
      ))}
      <p className="mk-nota">A quién le debes y quién te debe, en el mismo sitio.</p>
    </div>
  );
};

const RECURRENTES = [
  { nombre: 'Arriendo', monto: 1800000, dia: '1' },
  { nombre: 'Netflix', monto: 38900, dia: '8' },
  { nombre: 'Gimnasio', monto: 120000, dia: '12' },
  { nombre: 'Internet', monto: 95000, dia: '20' }
];

const MockRecurrentes: React.FC = () => {
  const quieto = useReducedMotion();
  return (
    <div className="mk">
      <span className="mk-titulo">Cada mes, sin falta</span>
      {RECURRENTES.map((r, i) => (
        <motion.div
          className="mk-fila"
          key={r.nombre}
          initial={quieto ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
        >
          <span className="mk-dia">{r.dia}</span>
          <div className="mk-fila-texto">
            <span className="mk-fila-nombre">{r.nombre}</span>
          </div>
          <span className="mk-fila-monto out">−{formatCop(r.monto)}</span>
        </motion.div>
      ))}
      <p className="mk-nota">Se registran solos. Tú solo confirmas.</p>
    </div>
  );
};

const CHARLA = [
  { de: 'yo' as const, texto: '¿En qué se me fue la plata este mes?' },
  {
    de: 'bot' as const,
    texto: 'Comida $620.000 — un 34% más que en julio. Casi todo en domicilios entre semana.'
  },
  { de: 'yo' as const, texto: '¿Cuánto llevo en domicilios?' },
  { de: 'bot' as const, texto: '$287.400 en 19 pedidos. El promedio te da $15.100 cada uno.' }
];

const MockAnalista: React.FC = () => {
  const quieto = useReducedMotion();
  return (
    <div className="mk mk-chat">
      <span className="mk-titulo">Pregúntale a tus números</span>
      {CHARLA.map((m, i) => (
        <motion.div
          className={`mk-burbuja ${m.de}`}
          key={m.texto}
          initial={quieto ? false : { opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15 + i * 0.35 }}
        >
          {m.texto}
        </motion.div>
      ))}
    </div>
  );
};

const MESES = [
  { mes: 'Mar', valor: 42 },
  { mes: 'Abr', valor: 58 },
  { mes: 'May', valor: 51 },
  { mes: 'Jun', valor: 73 },
  { mes: 'Jul', valor: 64 },
  { mes: 'Ago', valor: 88 }
];

const MockTendencias: React.FC = () => {
  const quieto = useReducedMotion();
  return (
    <div className="mk">
      <span className="mk-titulo">Gasto por mes</span>
      <div className="mk-grafico">
        {MESES.map((m, i) => (
          <div className="mk-columna" key={m.mes}>
            <motion.span
              className={`mk-columna-barra ${i === MESES.length - 1 ? 'destacada' : ''}`}
              initial={quieto ? false : { height: 0 }}
              animate={{ height: `${m.valor}%` }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            />
            <span className="mk-columna-mes">{m.mes}</span>
          </div>
        ))}
      </div>
      <p className="mk-nota">Seis meses de historia para ver el patrón, no el susto de hoy.</p>
    </div>
  );
};

/* ── Pestañas ─────────────────────────────────────────────────────────── */

const PESTANAS: {
  clave: string;
  Icono: LucideIcon;
  etiqueta: string;
  titulo: string;
  texto: string;
  Mockup: React.FC;
}[] = [
  {
    clave: 'cajitas',
    Icono: PiggyBank,
    etiqueta: 'Cajitas',
    titulo: 'Aparta plata sin sacarla del banco',
    texto:
      'El viaje, la matrícula, el fondo de emergencia. Cada cajita reserva un pedazo de tu saldo para que no te lo gastes sin darte cuenta.',
    Mockup: MockCajitas
  },
  {
    clave: 'presupuestos',
    Icono: Target,
    etiqueta: 'Presupuestos',
    titulo: 'Un techo por categoría',
    texto:
      'Define cuánto quieres gastar en comida, transporte o rumba. Ves el progreso mientras registras, no a fin de mes cuando ya no hay nada que hacer.',
    Mockup: MockPresupuestos
  },
  {
    clave: 'deudas',
    Icono: Wallet,
    etiqueta: 'Deudas',
    titulo: 'Tarjetas y préstamos, sin perderles el hilo',
    texto:
      'Saldo de cada tarjeta, fecha de corte, y los préstamos entre amigos que siempre se olvidan. También quién te debe a ti.',
    Mockup: MockDeudas
  },
  {
    clave: 'recurrentes',
    Icono: Repeat,
    etiqueta: 'Recurrentes',
    titulo: 'Lo que se repite, se registra solo',
    texto:
      'Arriendo, suscripciones, gimnasio. Los declaras una vez y aparecen cada mes en su fecha, listos para confirmar.',
    Mockup: MockRecurrentes
  },
  {
    clave: 'analista',
    Icono: Bot,
    etiqueta: 'Analista',
    titulo: 'Preguntas en español, respuestas con tus datos',
    texto:
      '«¿Cuánto llevo en domicilios?» «¿Gasté más que el mes pasado?» Responde con tus cifras, no con consejos genéricos de internet.',
    Mockup: MockAnalista
  },
  {
    clave: 'tendencias',
    Icono: TrendingUp,
    etiqueta: 'Tendencias',
    titulo: 'El patrón, no el susto de hoy',
    texto:
      'Comparaciones mes a mes, categorías que crecen, gastos hormiga que no se sienten hasta que los sumas.',
    Mockup: MockTendencias
  }
];

export const Funciones: React.FC = () => {
  const [activa, setActiva] = useState(PESTANAS[0].clave);
  const quieto = useReducedMotion();
  const actual = PESTANAS.find((p) => p.clave === activa) ?? PESTANAS[0];
  const { Mockup } = actual;

  return (
    <section className="funciones" id="funciones">
      <Reveal as="header" className="seccion-cabecera">
        <span className="seccion-etiqueta">Funciones</span>
        <TituloPalabras texto="Lo que hay adentro" resaltarUltimas={1} />
        <p className="seccion-sub">
          No es una lista de gastos con gráficos encima. Son las piezas que
          faltan cuando de verdad quieres manejar tu plata.
        </p>
      </Reveal>

      <Reveal className="funciones-tabs" delay={0.08}>
        <div className="tabs-riel" role="tablist" aria-label="Funciones de Lukapp">
          {PESTANAS.map(({ clave, Icono, etiqueta }) => (
            <button
              key={clave}
              role="tab"
              aria-selected={clave === activa}
              className={`tab ${clave === activa ? 'activa' : ''}`}
              onClick={() => setActiva(clave)}
            >
              {clave === activa && (
                <motion.span
                  layoutId="tab-fondo"
                  className="tab-fondo"
                  transition={{ duration: quieto ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <Icono size={16} strokeWidth={1.75} aria-hidden />
              <span>{etiqueta}</span>
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal className="funciones-panel" delay={0.14}>
        {/* Sin AnimatePresence: el panel viejo se desmonta de una y el nuevo
            entra animándose. Con `mode="wait"` el cambio de pestaña quedaba
            colgado de que terminara la animación de salida, y en un equipo
            lento o una pestaña en segundo plano —donde el navegador recorta los
            frames— la pestaña respondía pero el contenido no cambiaba. */}
        <motion.div
          key={actual.clave}
          className="funciones-contenido"
          initial={quieto ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="funciones-texto">
            <h3>{actual.titulo}</h3>
            <p>{actual.texto}</p>
          </div>
          <div className="funciones-visual">
            <Mockup />
          </div>
        </motion.div>
      </Reveal>
    </section>
  );
};
