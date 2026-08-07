import React from 'react';
import { AlertCircle, AlertTriangle, ArrowDownCircle, ArrowUpCircle, CheckCircle2, ClipboardList, Info, Lightbulb, Target } from 'lucide-react';
import { CATEGORY_COLOR, CATEGORY_ICON, CATEGORY_LABELS, tint } from '../types';
import { formatCop } from '../lib/formatCop';
import type { AnalisisResultado } from '../analista/tipos';
import { metricasCoherentes, rebanadasDelAnalisis, totalesDelAnalisis } from '../analista/totales';

interface AnalistaReporteProps {
  resultado: AnalisisResultado;
}

const TONO_SEVERIDAD = {
  alta: { bg: 'var(--fin-out-bg)', ink: 'var(--fin-out)', icon: AlertCircle },
  media: { bg: 'var(--fin-media-bg)', ink: 'var(--fin-media-ink)', icon: AlertTriangle },
  baja: { bg: 'var(--fin-baja-bg)', ink: 'var(--fin-baja-ink)', icon: Info },
} as const;

export const AnalistaReporte: React.FC<AnalistaReporteProps> = ({ resultado }) => {
  // Recomputed here rather than trusted: the model's own metrics table is prose,
  // the movement list is auditable line by line.
  const totales = totalesDelAnalisis(resultado.movimientos);
  const gastos = rebanadasDelAnalisis(resultado.movimientos, 'gasto');
  const cuadra = metricasCoherentes(resultado);

  return (
    <div className="flex flex-col gap-5">
      {/* Verdict */}
      <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
            <ClipboardList className="h-4 w-4" strokeWidth={2.5} /> Veredicto
          </h2>
          <span className="shrink-0 rounded-full bg-[var(--fin-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--fin-ink-soft)] capitalize">
            {resultado.periodo.etiqueta}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--fin-ink)]">{resultado.veredicto}</p>
      </section>

      {/* Recomputed totals */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { icon: ArrowUpCircle, label: 'Ingresos', valor: totales.ingresos, ink: 'var(--fin-in)', bg: 'var(--fin-in-bg)' },
          { icon: ArrowDownCircle, label: 'Gastos', valor: totales.gastos, ink: 'var(--fin-out)', bg: 'var(--fin-out-bg)' },
          {
            icon: totales.balance >= 0 ? CheckCircle2 : AlertTriangle,
            label: 'Balance',
            valor: totales.balance,
            ink: totales.balance >= 0 ? 'var(--fin-in)' : 'var(--fin-out)',
            bg: totales.balance >= 0 ? 'var(--fin-in-bg)' : 'var(--fin-out-bg)',
          },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-4">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ backgroundColor: k.bg, color: k.ink }}
              aria-hidden="true"
            >
              <k.icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <p className="mt-2 text-[11px] font-bold text-[var(--fin-ink-soft)]">{k.label}</p>
            <p className="truncate text-lg font-extrabold tabular-nums" style={{ color: k.ink }}>
              {formatCop(k.valor)}
            </p>
          </div>
        ))}
      </section>

      {/* What was left out of the totals, and why. Never silent. */}
      {totales.excluidos.length > 0 ? (
        <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-soft)] p-5">
          <h2 className="flex items-center gap-2 text-xs font-bold text-[var(--fin-ink-soft)]">
            <Info className="h-3.5 w-3.5" strokeWidth={3} />
            No se sumó a los totales
          </h2>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--fin-ink-soft)]">
            Sumar estas líneas contaría dos veces la misma plata.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {totales.excluidos.map((ex) => (
              <li
                key={ex.motivo}
                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--fin-card)] px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--fin-ink)]">
                  {ex.motivo}
                  <span className="ml-1.5 font-normal text-[var(--fin-ink-faint)]">({ex.cuantos})</span>
                </span>
                <span className="shrink-0 text-[13px] font-bold text-[var(--fin-ink-soft)] tabular-nums">
                  {formatCop(ex.montoCop)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Coherence warning: the narrative disagrees with the auditable rows. */}
      {!cuadra ? (
        <p className="flex items-start gap-2 rounded-2xl bg-[var(--fin-media-bg)] px-4 py-3 text-[11px] leading-relaxed text-[var(--fin-media-ink)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={3} />
          <span>
            La tabla de métricas no cuadra con los movimientos extraídos. Los totales de arriba se
            calcularon desde los movimientos, que se pueden auditar línea por línea.
          </span>
        </p>
      ) : null}

      {/* Category bars */}
      {gastos.length > 0 ? (
        <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
            <Target className="h-4 w-4" strokeWidth={2.5} /> En qué se fue
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {gastos.map((slice) => {
              const color = CATEGORY_COLOR[slice.categoria];
              const width = Math.max((slice.total / gastos[0].total) * 100, 4);
              return (
                <li key={slice.categoria} className="flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: tint(color, 0.14), color: color }}
                    aria-hidden="true"
                  >
                    {(() => {
                      const Icon = CATEGORY_ICON[slice.categoria];
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-bold">
                        {CATEGORY_LABELS[slice.categoria]}
                      </span>
                      <span className="shrink-0 text-[13px] font-extrabold tabular-nums">
                        {formatCop(slice.total)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--fin-soft)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${width}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-[11px] font-semibold text-[var(--fin-ink-faint)] tabular-nums">
                        {slice.pct}%
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Alerts */}
      {resultado.alertas.length > 0 ? (
        <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
            <AlertCircle className="h-4 w-4" strokeWidth={2.5} /> Alertas
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {resultado.alertas.map((alerta, idx) => {
              const tono = TONO_SEVERIDAD[alerta.severidad];
              return (
                <li
                  key={`${alerta.titulo}-${idx}`}
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: tono.bg }}
                >
                  <p className="flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: tono.ink }}>
                    <tono.icon className="h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={2.5} />
                    {alerta.titulo}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed" style={{ color: tono.ink }}>
                    {alerta.detalle}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Recommendations */}
      {resultado.recomendaciones.length > 0 ? (
        <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
            <Lightbulb className="h-4 w-4" strokeWidth={2.5} /> Qué puedes hacer
          </h2>
          <ol className="mt-3 flex flex-col gap-3">
            {resultado.recomendaciones.map((rec, idx) => (
              <li key={`${rec.titulo}-${idx}`} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--fin-soft)] text-[11px] font-extrabold text-[var(--fin-ink-soft)] tabular-nums">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-extrabold text-[var(--fin-ink)]">{rec.titulo}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--fin-ink-soft)]">{rec.detalle}</p>
                  {rec.ahorroMensualCop !== null ? (
                    <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[var(--fin-in-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--fin-in)]">
                      <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                      Ahorras ~{formatCop(rec.ahorroMensualCop)}/mes
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Things the model could not read confidently */}
      {resultado.advertencias.length > 0 ? (
        <section className="rounded-3xl bg-[var(--fin-baja-bg)] p-5">
          <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-baja-ink)]">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            Lo que no quedó claro
          </h2>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {resultado.advertencias.map((adv, idx) => (
              <li key={idx} className="text-[12px] leading-relaxed text-[var(--fin-baja-ink)]">
                · {adv}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="px-1 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
        Análisis informativo, no asesoría financiera certificada · generado con plantillas
        locales, sin inteligencia artificial.
      </p>
    </div>
  );
};
