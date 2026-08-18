import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Globe, Link2, Loader2, Monitor, Smartphone, Tablet } from 'lucide-react';
import { TemaToggle } from '../features/finanzas/components/TemaToggle';
import type { Tema } from '../features/finanzas/data/useTema';
import { obtenerSupabase } from '../features/finanzas/data/supabase';
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
                {/* La barra va detrás del texto, no al lado: así el nombre largo
                    se puede leer completo y la proporción se sigue viendo. */}
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

    // Bogotá es UTC-5 todo el año, así que la medianoche local se escribe fija.
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
  const topeDia = Math.max(...resumen.porDia.map((d) => d.vistas), 1);
  const topeHora = Math.max(...resumen.porHora.map((h) => h.vistas), 1);

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

              {/* Gráfica Día a Día */}
              <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                  Tráfico Día a Día
                </h3>

                {resumen.vistas === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--fin-ink-faint)]">
                    Todavía no hay visitas en este rango.
                  </p>
                ) : (
                  <div className="flex h-32 items-end gap-[2px]">
                    {resumen.porDia.map((d) => (
                      <div
                        key={d.fecha}
                        title={`${d.fecha}: ${d.vistas} vistas`}
                        className="flex-1 rounded-t bg-sky-500/70 transition-colors hover:bg-sky-500"
                        style={{ height: `${Math.max((d.vistas / topeDia) * 100, 2)}%` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Gráfica Horas Pico de Tráfico */}
              <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                    ⏰ Horas Pico de Tráfico (Hora Colombia UTC-5)
                  </h3>
                  <span className="text-[10px] text-[var(--fin-ink-faint)]">Distribución 00:00 a 23:00</span>
                </div>

                {resumen.vistas === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--fin-ink-faint)]">
                    Sin visitas registradas.
                  </p>
                ) : (
                  <div>
                    <div className="flex h-28 items-end gap-1 sm:gap-2">
                      {resumen.porHora.map((h) => (
                        <div
                          key={h.hora}
                          title={`${h.etiqueta}: ${h.vistas} vistas`}
                          className="group relative flex-1 flex flex-col items-center h-full justify-end"
                        >
                          <div
                            className="w-full rounded-t bg-gradient-to-t from-sky-600 to-cyan-400 transition-all group-hover:from-sky-500 group-hover:to-cyan-300"
                            style={{ height: `${Math.max((h.vistas / topeHora) * 100, h.vistas > 0 ? 8 : 2)}%` }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] font-semibold text-[var(--fin-ink-faint)] mt-2 px-1">
                      <span>00:00</span>
                      <span>06:00</span>
                      <span>12:00 m.</span>
                      <span>18:00</span>
                      <span>23:00</span>
                    </div>
                  </div>
                )}
              </div>

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
