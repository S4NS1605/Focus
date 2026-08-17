import React, { useState } from 'react';
import { Check, Pencil, Settings2, Wallet } from 'lucide-react';
import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento, CajitaTipo } from '../data/modelos';
import { CAJITA_ICONS, ES_PASIVO, TIPO_LABELS } from '../data/modelos';
import { iconoDeCajita } from '../cajitaIconos';
import { CategoriasEditor } from './CategoriasEditor';
import type { CategoriasEditorProps } from './CategoriasEditor';
import { idsPasivos, saldosPorCajita } from '../lib/cajitas';
import { formatAmountInput, formatCop, parseAmountInput, parseSaldoInput } from '../lib/formatCop';

interface ConfiguracionViewProps {
  transacciones: readonly Transaction[];
  cajitas: readonly Cajita[];
  movimientos: readonly CajitaMovimiento[];
  onActualizar: (cajita: Cajita) => void;
  onFijarSaldo: (cajitaId: string, saldo: number) => void;
  categorias: CategoriasEditorProps['categorias'];
  onCrearCategoria: CategoriasEditorProps['onCrear'];
  onActualizarCategoria: CategoriasEditorProps['onActualizar'];
  onArchivarCategoria: CategoriasEditorProps['onArchivar'];
  onBorrarCategoria: CategoriasEditorProps['onBorrar'];
  /** Ya montado: esta vista solo decide dónde va, no de qué habla. */
  panelGmf?: React.ReactNode;
  panelRespaldo?: React.ReactNode;
}

/**
 * Editing what already exists.
 *
 * Everything here could only be set at creation time before, which meant a rate
 * or a target typed wrong could only be fixed by deleting the pocket and losing
 * its whole history.
 *
 * Balances get their own column rather than living inside the edit form: the
 * common task is "update what my four accounts say today", and making that four
 * separate open-edit-save trips would be the slowest possible shape for it.
 */
const FilaCajita: React.FC<{
  cajita: Cajita;
  saldoCop: number;
  onActualizar: ConfiguracionViewProps['onActualizar'];
  onFijarSaldo: ConfiguracionViewProps['onFijarSaldo'];
}> = ({ cajita, saldoCop, onActualizar, onFijarSaldo }) => {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(cajita.nombre);
  const [icon, setIcon] = useState(cajita.icon);
  const [metaTexto, setMetaTexto] = useState(formatAmountInput(cajita.metaCop));
  const [tasaTexto, setTasaTexto] = useState(cajita.tasaEaPct === null ? '' : String(cajita.tasaEaPct));
  const [saldoTexto, setSaldoTexto] = useState(formatAmountInput(saldoCop));
  const [bajoMonto, setBajoMonto] = useState(cajita.esBajoMonto ?? false);

  const Icono = iconoDeCajita(cajita.icon);
  const pasivo = ES_PASIVO[cajita.tipo];
  const saldoNuevo = parseSaldoInput(saldoTexto);
  const saldoCambio = saldoNuevo !== null && saldoNuevo !== saldoCop;

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return;
    const tasa = Number.parseFloat(tasaTexto.replace(',', '.'));

    onActualizar({
      ...cajita,
      nombre: limpio,
      icon,
      metaCop: parseAmountInput(metaTexto),
      tasaEaPct: Number.isFinite(tasa) && tasa > 0 ? tasa : null,
      esBajoMonto: bajoMonto,
    });
    setEditando(false);
  };

  return (
    <li className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-3.5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--fin-soft)]"
          aria-hidden="true"
        >
          <Icono
            className="h-5 w-5"
            style={{ color: pasivo ? 'var(--fin-out)' : 'var(--fin-ink-soft)' }}
            strokeWidth={1.75}
          />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-extrabold text-[var(--fin-ink)]">{cajita.nombre}</p>
          <p className="text-[10px] text-[var(--fin-ink-faint)]">
            {TIPO_LABELS[cajita.tipo]}
            {cajita.tasaEaPct ? ` · ${cajita.tasaEaPct}% E.A.` : ''}
          </p>
        </div>

        {/* Inline balance, the thing most often needing a change. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex w-[7.5rem] shrink-0 items-center gap-1 rounded-xl border-2 border-[var(--fin-line)] bg-[var(--fin-bg)] px-2.5 py-1.5">
            <span className="text-xs font-bold text-[var(--fin-ink-faint)]">$</span>
            <input
              value={saldoTexto}
              onChange={(e) => setSaldoTexto(formatAmountInput(parseSaldoInput(e.target.value)))}
              inputMode="numeric"
              aria-label={`Saldo de ${cajita.nombre}`}
              className="w-full bg-transparent text-right text-base font-extrabold tabular-nums text-[var(--fin-ink)] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (saldoNuevo !== null) onFijarSaldo(cajita.id, saldoNuevo);
            }}
            disabled={!saldoCambio}
            aria-label={`Guardar saldo de ${cajita.nombre}`}
            className="rounded-xl bg-[var(--fin-accent)] p-2 text-[var(--fin-on-accent)] transition-opacity disabled:opacity-20"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            aria-label={`Editar ${cajita.nombre}`}
            aria-expanded={editando}
            className="rounded-xl p-2 text-[var(--fin-ink-faint)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {editando ? (
        <form onSubmit={guardar} className="mt-3 rounded-2xl bg-[var(--fin-soft)] p-3">
          <label className="block text-[11px] font-bold text-[var(--fin-ink-soft)]">
            Nombre
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1.5 w-full rounded-xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2 text-base font-medium text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
            />
          </label>

          {!pasivo ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-bold text-[var(--fin-ink-soft)]">
                Meta
                <input
                  value={metaTexto}
                  onChange={(e) => setMetaTexto(formatAmountInput(parseAmountInput(e.target.value)))}
                  inputMode="numeric"
                  placeholder="0"
                  className="mt-1.5 w-full rounded-xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2 text-base font-extrabold tabular-nums text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
                />
              </label>
              <label className="block text-[11px] font-bold text-[var(--fin-ink-soft)]">
                % E.A.
                <input
                  value={tasaTexto}
                  onChange={(e) => setTasaTexto(e.target.value.replace(/[^0-9.,]/g, ''))}
                  inputMode="decimal"
                  placeholder="13,5"
                  className="mt-1.5 w-full rounded-xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2 text-base font-extrabold tabular-nums text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
                />
              </label>
            </div>
          ) : null}

          <fieldset className="mt-3">
            <legend className="text-[11px] font-bold text-[var(--fin-ink-soft)]">Ícono</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {CAJITA_ICONS.map((op: string) => {
                const IconComponent = iconoDeCajita(op);
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setIcon(op)}
                    aria-pressed={icon === op}
                    aria-label={`Ícono ${op}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border-2 transition-colors ${
                      icon === op
                        ? 'border-[var(--fin-ink)] bg-[var(--fin-card)] text-[var(--fin-ink)]'
                        : 'border-[var(--fin-line)] bg-[var(--fin-card)] text-[var(--fin-ink-soft)]'
                    }`}
                  >
                    <IconComponent className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          {!pasivo ? (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5">
              <input
                type="checkbox"
                checked={bajoMonto}
                onChange={(e) => setBajoMonto(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--fin-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-[11px] font-bold text-[var(--fin-ink)]">
                  Es un depósito de bajo monto (ej. Nequi)
                </span>
                <span className="mt-0.5 block text-[10px] text-[var(--fin-ink-faint)]">
                  Tiene una exención de 4x1000 de hasta 65 UVT mensuales.
                </span>
              </span>
            </label>
          ) : null}

          <button
            type="submit"
            className="mt-3 w-full rounded-full bg-[var(--fin-accent)] px-4 py-2.5 text-xs font-bold text-[var(--fin-on-accent)]"
          >
            Guardar cambios
          </button>
        </form>
      ) : null}
    </li>
  );
};

const GRUPOS: ReadonlyArray<{ tipos: CajitaTipo[]; titulo: string }> = [
  { tipos: ['cuenta'], titulo: 'Cuentas bancarias' },
  { tipos: ['cajita'], titulo: 'Cajitas de ahorro' },
  { tipos: ['tarjeta', 'deuda'], titulo: 'Tarjetas y deudas' },
];

export const ConfiguracionView: React.FC<ConfiguracionViewProps> = ({
  cajitas,
  movimientos,
  transacciones,
  onActualizar,
  onFijarSaldo,
  categorias,
  onCrearCategoria,
  onActualizarCategoria,
  onArchivarCategoria,
  onBorrarCategoria,
  panelGmf,
  panelRespaldo,
}) => {
  const saldos = saldosPorCajita(movimientos, transacciones, idsPasivos(cajitas));
  const vivas = cajitas.filter((c) => c.archivedAt === null);

  // Having no accounts is the empty state of the BALANCES block, not of the
  // page: categories have nothing to do with accounts, and returning early here
  // left the only place to edit them unreachable until a pocket existed.
  const sinCuentas = vivas.length === 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {sinCuentas ? (
        <div className="rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-10 text-center">
          <Wallet className="mx-auto h-9 w-9 text-[var(--fin-ink-ghost)]" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-[var(--fin-ink)]">Todavía no tienes cuentas.</p>
          <p className="mt-1 text-xs text-[var(--fin-ink-faint)]">
            Crea una cuenta en Ahorro o una tarjeta en Deudas y aparecerá aquí.
          </p>
        </div>
      ) : (
        <section className="rounded-3xl bg-[var(--fin-soft)] px-4 py-3">
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[var(--fin-ink-soft)]">
            <Settings2 className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            Escribe el saldo que ves en tu banco y confirma con el visto. La app calcula sola la
            diferencia y la deja anotada en el historial.
          </p>
        </section>
      )}

      {GRUPOS.map((grupo) => {
        const delGrupo = vivas.filter((c) => grupo.tipos.includes(c.tipo));
        if (delGrupo.length === 0) return null;

        return (
          <section key={grupo.titulo}>
            <h2 className="px-1 text-xs font-bold text-[var(--fin-ink-soft)]">{grupo.titulo}</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {delGrupo.map((cajita) => (
                <FilaCajita
                  key={cajita.id}
                  cajita={cajita}
                  saldoCop={saldos.get(cajita.id) ?? 0}
                  onActualizar={onActualizar}
                  onFijarSaldo={onFijarSaldo}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {panelGmf}

      {panelRespaldo}

      <CategoriasEditor
        categorias={categorias}
        transacciones={transacciones}
        onCrear={onCrearCategoria}
        onActualizar={onActualizarCategoria}
        onArchivar={onArchivarCategoria}
        onBorrar={onBorrarCategoria}
      />

      {sinCuentas ? null : (
      <p className="px-1 text-[11px] text-[var(--fin-ink-faint)]">
        Total en cuentas y cajitas:{' '}
        <b className="text-[var(--fin-ink)]">
          {formatCop(
            vivas
              .filter((c) => !ES_PASIVO[c.tipo])
              .reduce((t, c) => t + (saldos.get(c.id) ?? 0), 0),
          )}
        </b>
      </p>
      )}
    </div>
  );
};
