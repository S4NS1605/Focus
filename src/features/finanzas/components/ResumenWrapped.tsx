import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarCheck,
  Flame,
  PartyPopper,
  Share2,
  Sparkles,
  Trophy,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import type { TarjetaResumen, Tono } from '../lib/resumenMes';
import { textoParaCompartir } from '../lib/resumenMes';
import { formatCop } from '../lib/formatCop';
import { dayLabel, monthKeyLabel } from '../lib/localDate';
import { tint } from '../types';
import { useCatalogo } from '../catalogoContexto';
import { useBloqueoScroll } from '../data/useBloqueoScroll';

interface ResumenWrappedProps {
  tarjetas: readonly TarjetaResumen[];
  onCerrar: () => void;
}

const COLOR_TONO: Record<Tono, string> = {
  bien: '#4ade80',
  atento: '#fb7185',
  neutral: '#f5f3f0',
};

/**
 * Una tarjeta de la historia: icono, etiqueta chica, número o frase grande, y
 * un detalle debajo. Es la misma forma para las nueve, para que el ojo no
 * tenga que reaprender el diseño en cada toque — solo cambian el color y el
 * texto.
 */
const Marco: React.FC<{
  icono: React.ReactNode;
  etiqueta: string;
  children: React.ReactNode;
  detalle?: React.ReactNode;
  color?: string;
}> = ({ icono, etiqueta, children, detalle, color = '#f5f3f0' }) => (
  <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center">
    <span
      className="flex h-16 w-16 items-center justify-center rounded-full"
      style={{ backgroundColor: tint(color, 0.16), color }}
      aria-hidden="true"
    >
      {icono}
    </span>
    <p className="text-[15px] font-semibold uppercase tracking-wide text-white/60">{etiqueta}</p>
    <div className="flex flex-col items-center gap-1 leading-tight text-white">{children}</div>
    {detalle ? <p className="max-w-xs text-[15px] leading-relaxed text-white/70">{detalle}</p> : null}
  </div>
);

const Cifra: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = '#f5f3f0',
}) => (
  <p
    className="tabular-nums"
    style={{ font: 'var(--fin-t-cifra)', letterSpacing: 'var(--fin-track-cifra)', color }}
  >
    {children}
  </p>
);

const TarjetaVista: React.FC<{
  tarjeta: TarjetaResumen;
  nombreDe: (categoria: string) => string;
  colorDe: (categoria: string) => string;
}> = ({ tarjeta, nombreDe, colorDe }) => {
  switch (tarjeta.tipo) {
    case 'portada':
      return (
        <Marco icono={<Sparkles className="h-7 w-7" strokeWidth={2} />} etiqueta="Tu resumen">
          <p className="text-[17px] font-normal text-white/70">Así fue tu</p>
          <p className="mt-2 text-[34px] font-bold capitalize text-white">
            {monthKeyLabel(tarjeta.mes)}
          </p>
        </Marco>
      );

    case 'balance': {
      const positivo = tarjeta.totals.balance >= 0;
      const color = positivo ? COLOR_TONO.bien : COLOR_TONO.atento;
      return (
        <Marco
          icono={
            positivo ? (
              <TrendingUp className="h-7 w-7" strokeWidth={2} />
            ) : (
              <TrendingDown className="h-7 w-7" strokeWidth={2} />
            )
          }
          etiqueta={positivo ? 'Te sobró' : 'Te faltó'}
          color={color}
          detalle={
            <>
              Entró {formatCop(tarjeta.totals.ingresos)} · Salió {formatCop(tarjeta.totals.gastos)}
              {tarjeta.totals.tasaAhorro !== null
                ? ` · Ahorraste el ${tarjeta.totals.tasaAhorro}%`
                : ''}
            </>
          }
        >
          <Cifra color={color}>{formatCop(Math.abs(tarjeta.totals.balance))}</Cifra>
        </Marco>
      );
    }

    case 'categoriaEstrella':
      return (
        <Marco
          icono={<Trophy className="h-7 w-7" strokeWidth={2} />}
          etiqueta="Tu categoría del mes"
          color={colorDe(tarjeta.slice.category)}
          detalle={`${tarjeta.slice.pct}% de lo que gastaste`}
        >
          <p className="text-[28px] font-bold text-white">{nombreDe(tarjeta.slice.category)}</p>
          <Cifra color={colorDe(tarjeta.slice.category)}>{formatCop(tarjeta.slice.total)}</Cifra>
        </Marco>
      );

    case 'cambioCategoria': {
      const { subida, bajada } = tarjeta;
      const principal = subida ?? bajada;
      if (!principal) return null;
      const esSubida = principal === subida;
      return (
        <Marco
          icono={
            esSubida ? (
              <TrendingUp className="h-7 w-7" strokeWidth={2} />
            ) : (
              <TrendingDown className="h-7 w-7" strokeWidth={2} />
            )
          }
          etiqueta={esSubida ? 'Lo que más subió' : 'Lo que más bajaste'}
          color={esSubida ? COLOR_TONO.atento : COLOR_TONO.bien}
          detalle={
            principal.deltaPct === null
              ? 'No gastabas en esto el mes pasado'
              : `${principal.deltaPct > 0 ? '+' : ''}${principal.deltaPct}% vs. el mes pasado`
          }
        >
          <p className="text-[28px] font-bold text-white">{nombreDe(principal.category)}</p>
          <Cifra color={esSubida ? COLOR_TONO.atento : COLOR_TONO.bien}>
            {esSubida ? '+' : ''}
            {formatCop(principal.deltaCop)}
          </Cifra>
        </Marco>
      );
    }

    case 'gastoMasCaro':
      return (
        <Marco
          icono={<span className="text-2xl">💸</span>}
          etiqueta="El gasto que más dolió"
          color={colorDe(tarjeta.tx.category)}
          detalle={
            <>
              {nombreDe(tarjeta.tx.category)} · {dayLabel(tarjeta.tx.occurredOn)}
            </>
          }
        >
          {tarjeta.tx.description ? (
            <p className="mb-1 text-[17px] font-normal text-white/70">{tarjeta.tx.description}</p>
          ) : null}
          <Cifra color={colorDe(tarjeta.tx.category)}>{formatCop(tarjeta.tx.amountCop)}</Cifra>
        </Marco>
      );

    case 'diasActivos':
      return (
        <Marco
          icono={<CalendarCheck className="h-7 w-7" strokeWidth={2} />}
          etiqueta="Días con movimiento"
          detalle={`de ${tarjeta.totalDias} días este mes`}
        >
          <Cifra>{tarjeta.activos}</Cifra>
        </Marco>
      );

    case 'racha':
      return (
        <Marco
          icono={<Flame className="h-7 w-7" strokeWidth={2} />}
          etiqueta="Tu racha más larga"
          color={COLOR_TONO.bien}
          detalle={
            tarjeta.dias === 0
              ? 'Este mes, ni un solo día sin gastar'
              : `${tarjeta.dias === 1 ? 'día' : 'días'} seguidos sin registrar un gasto`
          }
        >
          <Cifra color={COLOR_TONO.bien}>{tarjeta.dias}</Cifra>
        </Marco>
      );

    case 'comparadoConPromedio': {
      const masQueLoUsual = tarjeta.deltaPct > 0;
      return (
        <Marco
          icono={
            masQueLoUsual ? (
              <TrendingUp className="h-7 w-7" strokeWidth={2} />
            ) : (
              <TrendingDown className="h-7 w-7" strokeWidth={2} />
            )
          }
          etiqueta={masQueLoUsual ? 'Gastaste más de lo normal' : 'Gastaste menos de lo normal'}
          color={masQueLoUsual ? COLOR_TONO.atento : COLOR_TONO.bien}
          detalle={`Contra tu promedio de los últimos ${tarjeta.meses} ${tarjeta.meses === 1 ? 'mes' : 'meses'} (${formatCop(tarjeta.promedioCop)})`}
        >
          <Cifra color={masQueLoUsual ? COLOR_TONO.atento : COLOR_TONO.bien}>
            {masQueLoUsual ? '+' : ''}
            {tarjeta.deltaPct}%
          </Cifra>
        </Marco>
      );
    }

    case 'cierre':
      return (
        <Marco
          icono={<PartyPopper className="h-7 w-7" strokeWidth={2} />}
          etiqueta="Balance final"
          color={COLOR_TONO[tarjeta.tono]}
          detalle={tarjeta.frase}
        >
          <Cifra color={COLOR_TONO[tarjeta.tono]}>{formatCop(tarjeta.totals.balance)}</Cifra>
        </Marco>
      );

    default:
      return null;
  }
};

/**
 * El mes contado como historia: una tarjeta por toque, a pantalla completa.
 *
 * Deliberadamente NO usa los tokens `--fin-*`: es una experiencia aparte, no
 * una pantalla más de la app, y un fondo oscuro fijo es lo que hace que se
 * sienta distinta al resto — el mismo criterio que ya usa
 * `ReporteFinancieroModal` para su propia excepción, solo que en la dirección
 * opuesta (ese va a papel blanco siempre; este va oscuro siempre).
 *
 * La navegación es por toque, no por arrastre: un tercio izquierdo retrocede,
 * el resto avanza — la misma convención de Instagram/Spotify Wrapped, así que
 * nadie tiene que aprenderla.
 */
export const ResumenWrapped: React.FC<ResumenWrappedProps> = ({ tarjetas, onCerrar }) => {
  const [indice, setIndice] = useState(0);
  const [compartido, setCompartido] = useState(false);
  useBloqueoScroll(true);
  const catalogo = useCatalogo();
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    raiz.current?.focus();
  }, []);

  const actual = tarjetas[indice];
  const esUltima = indice >= tarjetas.length - 1;
  if (!actual) return null;

  const siguiente = () => setIndice((i) => Math.min(i + 1, tarjetas.length - 1));
  const anterior = () => setIndice((i) => Math.max(i - 1, 0));

  const alTocar = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const relativo = (e.clientX - left) / width;
    if (relativo < 0.3) anterior();
    else siguiente();
  };

  const compartir = async () => {
    const texto = textoParaCompartir(tarjetas, (c) => catalogo.de(c).nombre);
    if (navigator.share) {
      try {
        await navigator.share({ text: texto });
      } catch {
        // Cancelado por la persona, o el sistema operativo no lo dejó salir.
        // No hay nada más que hacer, y no es un error que valga la pena decir.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(texto);
      setCompartido(true);
      setTimeout(() => setCompartido(false), 2000);
    } catch {
      // Sin permiso de portapapeles tampoco hay más que ofrecer aquí.
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#0b0b12]"
      role="dialog"
      aria-modal="true"
      aria-label="Tu resumen del mes"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') siguiente();
        else if (e.key === 'ArrowLeft') anterior();
        else if (e.key === 'Escape') onCerrar();
      }}
      tabIndex={-1}
      ref={raiz}
    >
      <div className="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex flex-1 gap-1.5" aria-label={`Tarjeta ${indice + 1} de ${tarjetas.length}`}>
          {tarjetas.map((_, i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ backgroundColor: i <= indice ? '#ffffff' : 'rgb(255 255 255 / 0.25)' }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white"
        >
          <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1" onClick={alTocar}>
        <AnimatePresence mode="wait">
          <motion.div
            key={indice}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <TarjetaVista
              tarjeta={actual}
              nombreDe={(c) => catalogo.de(c).nombre}
              colorDe={(c) => catalogo.de(c).color}
            />
          </motion.div>
        </AnimatePresence>
        {indice === 0 ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-[13px] text-white/40">
            Toca para seguir
          </p>
        ) : null}
      </div>

      {esUltima ? (
        <div className="flex gap-3 px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void compartir();
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-white px-4 py-3.5 text-[17px] font-semibold text-black"
          >
            <Share2 className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            {compartido ? 'Copiado' : 'Compartir'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCerrar();
            }}
            className="flex items-center justify-center rounded-[var(--fin-r-control)] bg-white/10 px-5 py-3.5 text-[17px] font-semibold text-white"
          >
            Cerrar
          </button>
        </div>
      ) : null}
    </motion.div>
  );
};
