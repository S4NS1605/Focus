import React, { useState } from 'react';
import { AlertTriangle, Landmark, Scale } from 'lucide-react';
import type { Transaction } from '../types';
import type { RegimenGmf, ValorUvt } from '../lib/gmf';
import {
  ADVERTENCIA_GMF,
  NOTAS_GMF,
  TOPE_EXENTO_UVT,
  consumoDelMes,
  uvtDesactualizada,
} from '../lib/gmf';
import { formatCop, formatAmountInput, parseAmountInput, conPuntos } from '../lib/formatCop';

interface PanelGmfProps {
  transacciones: readonly Transaction[];
  mes: string;
  anioActual: number;
  cuentas: readonly { id: string; nombre: string; esBajoMonto?: boolean }[];
  uvt: ValorUvt;
  onCambiarUvt: (uvt: ValorUvt) => void;
  cuentasGmf: readonly string[];
  onCambiarCuentas: (ids: readonly string[]) => void;
  regimen: RegimenGmf;
  onCambiarRegimen: (r: RegimenGmf) => void;
  cuentaExentaId: string | null;
  onCambiarCuentaExenta: (id: string | null) => void;
}

/** 16px minimum: anything smaller makes iOS zoom the page in on focus. */
const CAMPO =
  'w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none';

/**
 * El 4x1000, explicado y estimado.
 *
 * Muestra el consumo del cupo exento del mes, pero lo importante de esta
 * pantalla es lo que dice y cómo lo dice: cada afirmación lleva su norma y la
 * fecha en que se verificó, y la advertencia de que quien liquida es el banco
 * está arriba, no escondida al final.
 */
export const PanelGmf: React.FC<PanelGmfProps> = ({
  transacciones,
  mes,
  anioActual,
  cuentas,
  uvt,
  onCambiarUvt,
  cuentasGmf,
  onCambiarCuentas,
  regimen,
  onCambiarRegimen,
  cuentaExentaId,
  onCambiarCuentaExenta,
}) => {
  const [editandoUvt, setEditandoUvt] = useState(false);
  const [borrador, setBorrador] = useState('');

  const cubiertas = new Set(cuentasGmf);
  const bajoMontoIds = new Set(cuentas.filter((c) => c.esBajoMonto).map((c) => c.id));
  const consumo = consumoDelMes(transacciones, mes, uvt, cubiertas, {
    regimen,
    cuentaExentaId,
    bajoMontoIds,
  });
  const vieja = uvtDesactualizada(uvt, anioActual);

  const alternar = (id: string) =>
    onCambiarCuentas(cubiertas.has(id) ? cuentasGmf.filter((x) => x !== id) : [...cuentasGmf, id]);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-1.5 px-1 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
          <Scale className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          El 4x1000
        </h2>
        {/* Arriba, no al final: si la cifra de abajo no es oficial, decirlo
 después de que ya la leyó no sirve de nada. */}
        <p className="mt-2 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
          {ADVERTENCIA_GMF}
        </p>
      </div>

      {/* Cómo te lo aplica TU banco. Los dos esquemas conviven en la práctica:
 la norma dice el nuevo, pero el reparto automático depende de que la
 entidad haya montado su sistema. */}
      <fieldset className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <legend className="px-1 text-[13px] font-semibold text-[var(--fin-ink-soft)]">
          ¿Cómo te lo aplica tu banco?
        </legend>
        <div className="mt-1 flex flex-col gap-1.5">
          {[
            {
              id: 'distribuido' as const,
              titulo: 'Repartido entre mis cuentas',
              nota: 'Lo que dice la norma desde diciembre de 2024. El cupo es tuyo, no de una cuenta.',
            },
            {
              id: 'marcada' as const,
              titulo: 'Solo una cuenta marcada',
              nota: 'El esquema viejo. Úsalo si tu banco todavía te cobra en las demás cuentas.',
            },
          ].map((op) => (
            <label
              key={op.id}
              className={`flex cursor-pointer items-start gap-2.5 rounded-[var(--fin-r-control)] border-2 px-3 py-2.5 transition-colors ${
                regimen === op.id
                  ? 'border-[var(--fin-ink)] bg-[var(--fin-bg)]'
                  : 'border-[var(--fin-line)]'
              }`}
            >
              <input
                type="radio"
                name="regimen-gmf"
                checked={regimen === op.id}
                onChange={() => onCambiarRegimen(op.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--fin-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-[var(--fin-ink)]">
                  {op.titulo}
                </span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
                  {op.nota}
                </span>
              </span>
            </label>
          ))}
        </div>

        {regimen === 'marcada' ? (
          <div className="mt-3">
            <label
              htmlFor="cuenta-exenta"
              className="block text-[13px] font-semibold text-[var(--fin-ink-soft)]"
            >
              ¿Cuál marcaste en el banco?
            </label>
            <select
              id="cuenta-exenta"
              value={cuentaExentaId ?? ''}
              onChange={(e) => onCambiarCuentaExenta(e.target.value || null)}
              className={`mt-1.5 ${CAMPO}`}
            >
              <option value="">Ninguna</option>
              {cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </fieldset>

      {/* Cupo del mes */}
      <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <p className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
          Tu cupo exento este mes
        </p>
        <p className="mt-1 text-[28px] font-semibold tabular-nums text-[var(--fin-ink)]">
          {formatCop(consumo.disponibleCop)}
        </p>
        <p className="mt-0.5 text-[13px] text-[var(--fin-ink-faint)]">
          libres de {formatCop(consumo.topeCop)} ({TOPE_EXENTO_UVT} UVT)
        </p>

        <div
          className="mt-3 h-2 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]"
          role="img"
          aria-label={`Has usado el ${consumo.pctUsado}% del cupo`}
        >
          <div
            className="h-full rounded-[var(--fin-r-pill)] transition-[width]"
            style={{
              width: `${consumo.pctUsado}%`,
              backgroundColor: consumo.pctUsado >= 100 ? 'var(--fin-out)' : 'var(--fin-in)',
            }}
          />
        </div>

        <p className="mt-2 text-[13px] text-[var(--fin-ink-soft)]">
          Han salido <b className="text-[var(--fin-ink)]">{formatCop(consumo.baseCop)}</b> de las
          cuentas que marcaste.
          {consumo.sinCupoCop > 0 ? (
            <>
              {' '}
              Otros <b className="text-[var(--fin-ink)]">{formatCop(consumo.sinCupoCop)}</b>{' '}
              salieron de cuentas sin cupo y pagan desde el primer peso.
            </>
          ) : null}
          {consumo.bajoMonto.totalGravadoCop > 0 ? (
            <>
              {' '}
              Se excedió el tope de depósitos de bajo monto por{' '}
              <b className="text-[var(--fin-out)]">
                {formatCop(consumo.bajoMonto.totalGravadoCop)}
              </b>
              , que también pagan.
            </>
          ) : null}
          {consumo.gravadoCop > 0 ? (
            <>
              {' '}
              En total pagarían{' '}
              <b className="text-[var(--fin-out)]">~{formatCop(consumo.gmfEstimadoCop)}</b> de
              4x1000 sobre {formatCop(consumo.gravadoCop)}.
            </>
          ) : null}
        </p>
      </div>

      {/* Cuentas que cuentan */}
      <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--fin-ink-soft)]">
          <Landmark className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
          ¿Cuáles están en una entidad financiera?
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
          Solo lo que sale de un banco, billetera o cooperativa consume cupo. El efectivo no.
        </p>

        {cuentas.length === 0 ? (
          <p className="mt-2.5 text-[13px] text-[var(--fin-ink-faint)]">
            Todavía no tienes cuentas registradas.
          </p>
        ) : (
          <ul className="mt-2.5 flex flex-col gap-1">
            {cuentas.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--fin-r-control)] bg-[var(--fin-bg)] px-3 py-2.5">
                  <span className="min-w-0 truncate text-[15px] font-semibold text-[var(--fin-ink)]">
                    {c.nombre}
                  </span>
                  <input
                    type="checkbox"
                    checked={cubiertas.has(c.id)}
                    onChange={() => alternar(c.id)}
                    aria-label={`${c.nombre} está en una entidad financiera`}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--fin-accent)]"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* La UVT */}
      <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <p className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
          Valor de la UVT ({uvt.anio})
        </p>

        {editandoUvt ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const pesos = parseAmountInput(borrador);
              if (pesos !== null && pesos > 0) {
                onCambiarUvt({ anio: anioActual, pesos, fuente: 'Editado a mano' });
              }
              setEditandoUvt(false);
            }}
            className="mt-2 flex items-center gap-2"
          >
            <input
              value={borrador}
              onChange={(e) => setBorrador(conPuntos(e.target.value))}
              inputMode="numeric"
              aria-label="Valor de la UVT en pesos"
              autoFocus
              className={CAMPO}
            />
            <button
              type="submit"
              className="shrink-0 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-on-accent)]"
            >
              Guardar
            </button>
          </form>
        ) : (
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="text-[28px] font-semibold tabular-nums text-[var(--fin-ink)]">
              {formatCop(uvt.pesos)}
            </p>
            <button
              type="button"
              onClick={() => {
                setBorrador(formatAmountInput(uvt.pesos));
                setEditandoUvt(true);
              }}
              className="shrink-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-1.5 text-[13px] font-semibold text-[var(--fin-ink-soft)]"
            >
              Cambiar
            </button>
          </div>
        )}

        {uvt.fuente ? (
          <p className="mt-1 text-[13px] text-[var(--fin-ink-faint)]">{uvt.fuente}</p>
        ) : null}

        {/* La UVT cambia cada enero. Calcular en silencio con la del año pasado
 daría un tope equivocado sin que nadie se entere. */}
        {vieja ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-warn-bg)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--fin-warn-ink)]">
            <AlertTriangle
              className="mt-px h-3.5 w-3.5 shrink-0"
              strokeWidth={3}
              aria-hidden="true"
            />
            Este valor es de {uvt.anio} y estamos en {anioActual}. La DIAN publica uno nuevo cada
            diciembre — actualízalo o el cupo de arriba estará mal.
          </p>
        ) : null}
      </div>

      {/* Lo que dice la norma */}
      <div className="flex flex-col gap-2">
        {NOTAS_GMF.map((nota) => (
          <details
            key={nota.id}
            className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4 py-3"
          >
            <summary className="cursor-pointer text-[15px] font-semibold text-[var(--fin-ink)]">
              {nota.titulo}
            </summary>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
              {nota.cuerpo}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
              {nota.fundamento} · verificado el {nota.verificado}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
};
