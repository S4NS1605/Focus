import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Clock, Globe, Link2, Loader2, Monitor, Smartphone, Tablet } from 'lucide-react';
import { TemaToggle } from '../features/lukapp/components/TemaToggle';
import type { Tema } from '../features/lukapp/data/useTema';
import { obtenerSupabase } from '../features/lukapp/data/supabase';
import type { Conteo, Visita } from './estadisticas';
import { banderaDePais, diasHasta, nombreDePais, resumir } from './estadisticas';

interface EstadisticasPanelProps {
  onBack: () => void;
  tema: Tema;
  onCambiarTema: (tema: Tema) => void;
}

/** El detalle crudo se borra a los 90 días, así que no hay rango más largo. */
const RANGOS = [
  { dias: 7, texto: '7 días' },
  { dias: 30, texto: '30 días' },
  { dias: 90, texto: '90 días' },
];

const ICONO_DISPOSITIVO: Record<string, React.ReactNode> = {
  movil: <Smartphone className="h-3.5 w-3.5" />,
  tablet: <Tablet className="h-3.5 w-3.5" />,
  escritorio: <Monitor className="h-3.5 w-3.5" />,
};

const NOMBRE_DISPOSITIVO: Record<string, string> = {
  movil: 'Celular',
  tablet: 'Tableta',
  escritorio: 'Computador',
};

const formatearFechaCorta = (iso: string): string => {
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  const mes = parseInt(parts[1], 10) - 1;
  const dia = parseInt(parts[2], 10);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dia} ${meses[mes] || parts[1]}`;
};

interface BarraItem {
  id: string;
  etiqueta: string;
  subetiqueta?: string;
  valor: number;
  secundario?: number;
}

/** Gráfica de barras interactiva unificada con visualización instantánea (0ms espera). */
const GraficaBarrasUnificada: React.FC<{
  titulo: string;
  subtitulo?: string;
  icono?: React.ReactNode;
  items: BarraItem[];
  vacio: string;
  pieDeGrafica?: React.ReactNode;
}> = ({ titulo, subtitulo, icono, items, vacio, pieDeGrafica }) => {
  const [hovered, setHovered] = useState<BarraItem | null>(null);
  const maxValor = Math.max(...items.map((i) => i.valor), 1);
  const total = items.reduce((acc, i) => acc + i.valor, 0);

  const pico = useMemo(() => {
    if (total === 0) return null;
    return items.reduce((max, i) => (i.valor > max.valor ? i : max), items[0]);
  }, [items, total]);

  const activo = hovered ?? pico;

  return (
    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 sm:p-6 shadow-sm transition-colors">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {icono}
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
              {titulo}
            </h3>
          </div>
          {subtitulo && <p className="text-[10px] text-[var(--fin-ink-faint)] mt-0.5">{subtitulo}</p>}
        </div>

        {/* Resumen instantáneo en vivo sin tener que esperar tooltips */}
        {total > 0 && activo && (
          <div className="flex items-center gap-2 rounded-xl bg-[var(--fin-soft)] px-3 py-1.5 transition-all self-start sm:self-auto">
            <span className="text-[10px] font-semibold text-[var(--fin-ink-faint)] uppercase tracking-wider">
              {hovered ? 'Seleccionado:' : 'Pico más alto:'}
            </span>
            <span className="text-xs font-bold text-[var(--fin-ink)]">
              {activo.etiqueta}
            </span>
            <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
              {activo.valor.toLocaleString('es-CO')} {activo.valor === 1 ? 'vista' : 'vistas'}
            </span>
            {activo.secundario !== undefined && activo.secundario > 0 && (
              <span className="text-[10px] text-[var(--fin-ink-soft)] font-medium">
                · {activo.secundario} {activo.secundario === 1 ? 'visitante' : 'visitantes'}
              </span>
            )}
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--fin-ink-faint)]">{vacio}</p>
      ) : (
        <div>
          <div className="flex h-36 items-end gap-[3px] sm:gap-1.5 pt-7 pb-1">
            {items.map((item) => {
              const esHover = hovered?.id === item.id;
              const esPico = !hovered && pico?.id === item.id && item.valor > 0;
              const destacado = esHover || esPico;
              const porcentaje = Math.max((item.valor / maxValor) * 100, item.valor > 0 ? 8 : 3);

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHovered(item)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setHovered(item)}
                  className="group relative flex-1 h-full flex flex-col justify-end items-center cursor-pointer select-none"
                >
                  {/* Tooltip flotante instantáneo (0ms de retraso) */}
                  <div
                    className={`pointer-events-none absolute -top-8 z-30 whitespace-nowrap rounded-lg bg-[var(--fin-ink)] px-2.5 py-1 text-[10px] font-bold text-[var(--fin-bg)] shadow-xl transition-all duration-150 ${
                      esHover ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                    }`}
                  >
                    {item.etiqueta}: {item.valor} vistas
                    <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-[var(--fin-ink)]" />
                  </div>

                  {/* Barra única y consistente */}
                  <div
                    className={`w-full rounded-t-sm transition-all duration-150 ${
                      destacado
                        ? 'bg-sky-400'
                        : item.valor > 0
                        ? 'bg-sky-500/80 hover:bg-sky-400'
                        : 'bg-[var(--fin-soft)]/60 hover:bg-[var(--fin-soft)]'
                    }`}
                    style={{ height: `${porcentaje}%` }}
                  />
                </div>
              );
            })}
          </div>

          {pieDeGrafica}
        </div>
      )}
    </div>
  );
};

/** Una lista de "lo más X", con su barra proporcional y porcentaje. */
const Tabla: React.FC<{
  titulo: string;
  icono: React.ReactNode;
  filas: Conteo[];
  totalVistas: number;
  etiqueta?: (clave: string) => React.ReactNode;
  vacio: string;
}> = ({ titulo, icono, filas, totalVistas, etiqueta, vacio }) => {
  const tope = filas[0]?.n ?? 1;

  return (
    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
      <h3 className="mb-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
        <span className="flex items-center gap-2">
          {icono}
          {titulo}
        </span>
        <span className="text-[10px] font-semibold text-[var(--fin-ink-faint)] lowercase">{filas.length} registros</span>
      </h3>

      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--fin-ink-faint)]">{vacio}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filas.slice(0, 8).map((fila) => {
            const pct = totalVistas > 0 ? Math.round((fila.n / totalVistas) * 100) : 0;
            return (
              <li key={fila.clave} className="relative">
                <div
                  className="absolute inset-y-0 left-0 rounded-lg bg-sky-500/10"
                  style={{ width: `${Math.max((fila.n / tope) * 100, 4)}%` }}
                  aria-hidden="true"
                />
                <div className="relative flex items-center justify-between gap-3 px-2.5 py-1.5">
                  <span className="truncate text-sm font-medium text-[var(--fin-ink)]">
                    {etiqueta ? etiqueta(fila.clave) : fila.clave}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-md bg-[var(--fin-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--fin-ink-soft)]">
                      {pct}%
                    </span>
                    <span className="text-sm font-bold tabular-nums text-[var(--fin-ink)]">
                      {fila.n.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const EstadisticasPanel: React.FC<EstadisticasPanelProps> = ({
  onBack,
  tema,
  onCambiarTema,
}) => {
  const [rango, setRango] = useState(30);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dias = useMemo(() => diasHasta(new Date(), rango), [rango]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);

    const cliente = obtenerSupabase();
    if (!cliente) {
      setError('No hay conexión con Supabase.');
      setCargando(false);
      return;
    }

    const desde = `${dias[0]}T00:00:00-05:00`;

    const { data, error: fallo } = await cliente
      .from('visitas')
      .select('ruta,referente,pais,dispositivo,visitante,creado_en')
      .gte('creado_en', desde)
      .order('creado_en', { ascending: false });

    if (fallo) setError(fallo.message);
    else setVisitas((data ?? []) as Visita[]);

    setCargando(false);
  }, [dias]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resumen = useMemo(() => resumir(visitas, dias), [visitas, dias]);

  // Adaptadores para la gráfica unificada
  const itemsDia: BarraItem[] = useMemo(
    () =>
      resumen.porDia.map((d) => ({
        id: d.fecha,
        etiqueta: formatearFechaCorta(d.fecha),
        subetiqueta: d.fecha,
        valor: d.vistas,
        secundario: d.visitantes,
      })),
    [resumen.porDia],
  );

  const itemsHora: BarraItem[] = useMemo(
    () =>
      resumen.porHora.map((h) => ({
        id: `h-${h.hora}`,
        etiqueta: h.etiqueta,
        valor: h.vistas,
      })),
    [resumen.porHora],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--fin-bg)] font-sans text-[var(--fin-ink)] transition-colors duration-300">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--fin-line)] bg-[var(--fin-bg)]/80 px-4 py-3 backdrop-blur-xl transition-colors sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Volver al ecosistema"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-400">
              <BarChart3 className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Visitantes</h1>
          </div>
        </div>

        <TemaToggle tema={tema} onCambiar={onCambiarTema} />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-8 sm:p-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Quién pasa por el portafolio</h2>
              <p className="mt-2 text-sm text-[var(--fin-ink-soft)]">
                Sin cookies y sin guardar una sola IP.
              </p>
            </div>

            <div
              role="group"
              aria-label="Rango de tiempo"
              className="flex gap-1 rounded-xl bg-[var(--fin-soft)] p-1"
            >
              {RANGOS.map((r) => (
                <button
                  key={r.dias}
                  type="button"
                  onClick={() => setRango(r.dias)}
                  aria-pressed={rango === r.dias}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition-colors ${
                    rango === r.dias
                      ? 'bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-sm'
                      : 'text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
                  }`}
                >
                  {r.texto}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl bg-[var(--fin-out-bg)] px-4 py-3 text-sm font-medium text-[var(--fin-out-ink)]">
              {error}
            </div>
          ) : cargando ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                    Páginas vistas
                  </p>
                  <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight">
                    {resumen.vistas.toLocaleString('es-CO')}
                  </p>
                </div>

                <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                    Visitantes por día, sumados
                  </p>
                  <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight">
                    {resumen.visitantes.toLocaleString('es-CO')}
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
                    Quien vuelve otro día cuenta de nuevo: el identificador rota cada medianoche
                    para que nadie pueda ser seguido entre días.
                  </p>
                </div>
              </div>

              {/* Gráfica Día a Día (Estilo Unificado) */}
              <GraficaBarrasUnificada
                titulo="Tráfico Día a Día"
                subtitulo={`Últimos ${rango} días en horario local`}
                icono={<BarChart3 className="h-3.5 w-3.5 text-sky-500" />}
                items={itemsDia}
                vacio="Todavía no hay visitas en este rango."
              />

              {/* Gráfica Horas Pico de Tráfico (Mismo Estilo Unificado) */}
              <GraficaBarrasUnificada
                titulo="Horas Pico de Tráfico"
                subtitulo="Distribución horaria (Hora Colombia UTC-5)"
                icono={<Clock className="h-3.5 w-3.5 text-sky-500" />}
                items={itemsHora}
                vacio="Sin visitas registradas."
                pieDeGrafica={
                  <div className="flex justify-between text-[10px] font-semibold text-[var(--fin-ink-faint)] mt-2.5 px-1">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00 m.</span>
                    <span>18:00</span>
                    <span>23:00</span>
                  </div>
                }
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <Tabla
                  titulo="Qué miran (Rutas)"
                  icono={<BarChart3 className="h-3.5 w-3.5" />}
                  filas={resumen.rutas}
                  totalVistas={resumen.vistas}
                  vacio="Nada todavía."
                />
                <Tabla
                  titulo="De dónde son (Países)"
                  icono={<Globe className="h-3.5 w-3.5" />}
                  filas={resumen.paises}
                  totalVistas={resumen.vistas}
                  etiqueta={(c) => `${banderaDePais(c)}  ${nombreDePais(c)}`}
                  vacio="Nada todavía."
                />
                <Tabla
                  titulo="Fuentes de Tráfico"
                  icono={<Link2 className="h-3.5 w-3.5" />}
                  filas={resumen.fuentes}
                  totalVistas={resumen.vistas}
                  vacio="Nada todavía."
                />
                <Tabla
                  titulo="Dispositivos"
                  icono={<Monitor className="h-3.5 w-3.5" />}
                  filas={resumen.dispositivos}
                  totalVistas={resumen.vistas}
                  etiqueta={(c) => (
                    <span className="flex items-center gap-2">
                      {ICONO_DISPOSITIVO[c]}
                      {NOMBRE_DISPOSITIVO[c] ?? c}
                    </span>
                  )}
                  vacio="Nada todavía."
                />
              </div>

              <p className="px-1 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
                De cada visita se guarda la página, el dominio por el que llegó, el país y el tipo
                de dispositivo. Nunca la IP, ni el navegador completo, ni la ciudad. El detalle se
                borra a los 90 días y solo quedan los totales por día.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
