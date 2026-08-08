import React, { useState } from 'react';
import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_ICON, CATEGORY_LABELS, tint } from '../types';
import type { Category } from '../types';
import type { Cajita, CajitaMovimiento, CajitaMovKind, CajitaTipo } from '../data/modelos';
import { CAJITA_ICONS, CAJITA_MOV_LABELS, TIPO_LABELS } from '../data/modelos';
import { iconoDeCajita } from '../cajitaIconos';
import { historialDeCajita, resumenDePasivos } from '../lib/cajitas';
import { formatAmountInput, formatCop, parseAmountInput, parseSaldoInput } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';

interface DeudasViewProps {
  cajitas: readonly Cajita[];
  movimientos: readonly CajitaMovimiento[];
  onCrear: (datos: {
    nombre: string;
    icon: string;
    tipo: CajitaTipo;
    metaCop: number | null;
    tasaEaPct: number | null;
    saldoInicialCop: number;
  }) => void;
  onFijarSaldo: (cajitaId: string, saldo: number) => void;
  onMovimiento: (
    cajitaId: string,
    kind: CajitaMovKind,
    deltaCop: number,
    categoria?: Category | null,
  ) => void;
  onEliminar: (cajitaId: string) => void;
}

type Accion = 'compra' | 'abono' | 'saldo';

/**
 * A debt tracked the same way a pocket is, but read the other way round: the
 * balance is what is owed, a purchase raises it and a payment lowers it.
 *
 * Purchases carry a category because that is the entire point — a card balance
 * that only goes up with no explanation is exactly the problem a paper
 * statement has.
 */
const DeudaCard: React.FC<{
  cajita: Cajita;
  saldoCop: number;
  movimientos: readonly CajitaMovimiento[];
  onFijarSaldo: DeudasViewProps['onFijarSaldo'];
  onMovimiento: DeudasViewProps['onMovimiento'];
  onEliminar: DeudasViewProps['onEliminar'];
}> = ({ cajita, saldoCop, movimientos, onFijarSaldo, onMovimiento, onEliminar }) => {
  const [accion, setAccion] = useState<Accion | null>(null);
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState<Category>('otros');
  const [confirmando, setConfirmando] = useState(false);

  const historial = historialDeCajita(movimientos, cajita.id);
  const Icono = iconoDeCajita(cajita.icon);
  const leer = accion === 'saldo' ? parseSaldoInput : parseAmountInput;
  const valor = leer(texto);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (valor === null || accion === null) return;

    if (accion === 'saldo') onFijarSaldo(cajita.id, valor);
    // A purchase adds to what you owe; a payment takes away from it.
    else if (accion === 'compra') onMovimiento(cajita.id, 'compra', Math.abs(valor), categoria);
    else onMovimiento(cajita.id, 'abono', -Math.abs(valor), null);

    setAccion(null);
    setTexto('');
  };

  const abrir = (siguiente: Accion) => {
    const misma = accion === siguiente;
    setAccion(misma ? null : siguiente);
    setTexto(misma ? '' : siguiente === 'saldo' ? formatAmountInput(saldoCop) : '');
  };

  return (
    <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--fin-out-bg)]"
          aria-hidden="true"
        >
          <Icono className="h-6 w-6 text-[var(--fin-out)]" strokeWidth={1.75} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-extrabold text-[var(--fin-ink)]">{cajita.nombre}</h3>
          <p className="text-[10px] font-semibold text-[var(--fin-ink-faint)]">
            {TIPO_LABELS[cajita.tipo]}
          </p>
          <p className="mt-0.5 font-display text-2xl font-extrabold tabular-nums text-[var(--fin-out)]">
            {formatCop(saldoCop)}
          </p>
          <p className="text-[10px] text-[var(--fin-ink-faint)]">debes</p>
        </div>

        <button
          type="button"
          onClick={() => setConfirmando((v) => !v)}
          aria-label={`Eliminar ${cajita.nombre}`}
          className="shrink-0 rounded-xl p-1.5 text-[var(--fin-ink-ghost)] transition-colors hover:bg-[var(--fin-out-bg)] hover:text-[var(--fin-out)]"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      {confirmando ? (
        <div className="mt-3 rounded-2xl bg-[var(--fin-out-bg)] p-3">
          <p className="text-[11px] leading-relaxed text-[var(--fin-out-ink)]">
            Se elimina y con ella todo su historial de cargos y abonos.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => onEliminar(cajita.id)}
              className="rounded-full bg-[var(--fin-out)] px-4 py-2 text-xs font-bold text-white"
            >
              Eliminar
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-full bg-[var(--fin-card)] px-4 py-2 text-xs font-bold text-[var(--fin-ink-soft)]"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(
          [
            { id: 'compra', label: 'Registrar compra' },
            { id: 'abono', label: 'Abonar' },
            { id: 'saldo', label: 'Actualizar saldo' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => abrir(item.id)}
            aria-pressed={accion === item.id}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
              accion === item.id
                ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
                : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {accion ? (
        <form onSubmit={enviar} className="mt-3 rounded-2xl bg-[var(--fin-soft)] p-3">
          <div className="flex items-center gap-2 rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5">
            <span className="font-display text-xl font-extrabold text-[var(--fin-ink-faint)]">$</span>
            <input
              value={texto}
              onChange={(e) => setTexto(formatAmountInput(leer(e.target.value)))}
              inputMode="numeric"
              placeholder="0"
              autoFocus
              aria-label="Monto"
              className="w-full bg-transparent font-display text-xl font-extrabold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            />
          </div>

          {/* Only purchases get a category: an payment against the balance is not
              spending on anything, it is settling what was already spent. */}
          {accion === 'compra' ? (
            <fieldset className="mt-3">
              <legend className="text-[11px] font-bold text-[var(--fin-ink-soft)]">
                ¿En qué fue?
              </legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CATEGORIES.map((op) => {
                  const activa = categoria === op;
                  const color = CATEGORY_COLOR[op];
                  const IconoCat = CATEGORY_ICON[op];
                  return (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setCategoria(op)}
                      aria-pressed={activa}
                      className="flex items-center gap-1 rounded-full border-2 px-2.5 py-1.5 text-[10px] font-bold transition-colors"
                      style={{
                        backgroundColor: activa ? tint(color, 0.16) : 'var(--fin-card)',
                        borderColor: activa ? color : 'var(--fin-line)',
                        color: activa ? 'var(--fin-ink)' : 'var(--fin-ink-soft)',
                      }}
                    >
                      <IconoCat className="h-3 w-3" style={{ color }} aria-hidden="true" />
                      {CATEGORY_LABELS[op]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <button
            type="submit"
            disabled={valor === null}
            className="mt-3 w-full rounded-full bg-[var(--fin-accent)] px-4 py-2.5 text-xs font-bold text-[var(--fin-on-accent)] disabled:opacity-30"
          >
            Guardar
          </button>
        </form>
      ) : null}

      {historial.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {historial.slice(0, 6).map(({ movimiento, saldoDespues }) => (
            <li
              key={movimiento.id}
              className="flex items-center gap-2.5 rounded-xl bg-[var(--fin-bg)] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold text-[var(--fin-ink)]">
                  {movimiento.categoria
                    ? CATEGORY_LABELS[movimiento.categoria]
                    : CAJITA_MOV_LABELS[movimiento.kind]}
                </p>
                <p className="text-[10px] text-[var(--fin-ink-faint)]">
                  {dayLabel(movimiento.occurredOn)} · debías {formatCop(saldoDespues)}
                </p>
              </div>
              <span
                className="shrink-0 text-[11px] font-extrabold tabular-nums"
                style={{ color: movimiento.deltaCop >= 0 ? 'var(--fin-out)' : 'var(--fin-in)' }}
              >
                {movimiento.deltaCop >= 0 ? '+' : '−'}
                {formatCop(Math.abs(movimiento.deltaCop))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 px-1 text-[11px] text-[var(--fin-ink-faint)]">Sin cargos todavía.</p>
      )}
    </section>
  );
};

export const DeudasView: React.FC<DeudasViewProps> = ({
  cajitas,
  movimientos,
  onCrear,
  onFijarSaldo,
  onMovimiento,
  onEliminar,
}) => {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<CajitaTipo>('tarjeta');
  const [icon, setIcon] = useState<string>(CAJITA_ICONS[0]);
  const [saldoTexto, setSaldoTexto] = useState('');

  const filas = resumenDePasivos(cajitas, movimientos);
  const total = filas.reduce((t, f) => t + f.saldoCop, 0);

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return;

    onCrear({
      nombre: limpio,
      icon,
      tipo,
      metaCop: null,
      tasaEaPct: null,
      saldoInicialCop: parseAmountInput(saldoTexto) ?? 0,
    });
    setNombre('');
    setSaldoTexto('');
    setTipo('tarjeta');
    setCreando(false);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
        <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
          <CreditCard className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          Lo que debes
        </h2>
        <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-[var(--fin-out)]">
          {formatCop(total)}
        </p>
        {filas.length > 0 ? (
          <p className="mt-1 text-[11px] text-[var(--fin-ink-faint)]">
            entre {filas.length} {filas.length === 1 ? 'obligación' : 'obligaciones'}
          </p>
        ) : null}
      </section>

      {creando ? (
        <form
          onSubmit={crear}
          className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5"
        >
          <h2 className="text-xs font-bold text-[var(--fin-ink-soft)]">Nueva obligación</h2>

          <fieldset className="mt-4">
            <legend className="text-xs font-bold text-[var(--fin-ink-soft)]">¿Qué es?</legend>
            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--fin-soft)] p-1.5">
              {(['tarjeta', 'deuda'] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setTipo(op)}
                  aria-pressed={tipo === op}
                  className={`rounded-xl px-3 py-2.5 text-[11px] font-bold transition-colors ${
                    tipo === op
                      ? 'bg-[var(--fin-card)] text-[var(--fin-ink)]'
                      : 'text-[var(--fin-ink-soft)]'
                  }`}
                >
                  {TIPO_LABELS[op]}
                </button>
              ))}
            </div>
          </fieldset>

          <label htmlFor="deuda-nombre" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            Nombre
          </label>
          <input
            id="deuda-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={tipo === 'tarjeta' ? 'Ej: Visa Davivienda' : 'Ej: Préstamo a mi mamá'}
            autoFocus
            className="mt-2 w-full rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-base font-medium text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none"
          />

          <label htmlFor="deuda-saldo" className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">
            ¿Cuánto debes ahora?
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3">
            <span className="font-display text-xl font-extrabold text-[var(--fin-ink-faint)]">$</span>
            <input
              id="deuda-saldo"
              value={saldoTexto}
              onChange={(e) => setSaldoTexto(formatAmountInput(parseAmountInput(e.target.value)))}
              inputMode="numeric"
              placeholder="0"
              className="w-full bg-transparent font-display text-xl font-extrabold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            />
          </div>

          <fieldset className="mt-4">
            <legend className="text-xs font-bold text-[var(--fin-ink-soft)]">Ícono</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CAJITA_ICONS.map((op: string) => {
                const IconComponent = iconoDeCajita(op);
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setIcon(op)}
                    aria-pressed={icon === op}
                    aria-label={`Ícono ${op}`}
                    className={`flex h-10 w-10 items-center justify-center rounded-2xl border-2 transition-colors ${
                      icon === op
                        ? 'border-[var(--fin-ink)] bg-[var(--fin-soft)] text-[var(--fin-ink)]'
                        : 'border-[var(--fin-line)] bg-[var(--fin-card)] text-[var(--fin-ink-soft)]'
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              disabled={nombre.trim() === ''}
              className="flex-1 rounded-full bg-[var(--fin-accent)] px-6 py-3.5 text-sm font-bold text-[var(--fin-on-accent)] disabled:opacity-30"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => setCreando(false)}
              className="rounded-full bg-[var(--fin-soft)] px-6 py-3.5 text-sm font-bold text-[var(--fin-ink-soft)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-4 text-sm font-bold text-[var(--fin-ink-soft)] transition-colors hover:border-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
          Nueva deuda o tarjeta
        </button>
      )}

      {filas.length === 0 && !creando ? (
        <div className="rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-12 text-center">
          <CreditCard
            className="mx-auto h-9 w-9 text-[var(--fin-ink-ghost)]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-bold text-[var(--fin-ink)]">No debes nada registrado.</p>
          <p className="mt-1 text-xs text-[var(--fin-ink-faint)]">
            Agrega una tarjeta o un préstamo para llevarle el rastro.
          </p>
        </div>
      ) : null}

      {filas.map((fila) => (
        <DeudaCard
          key={fila.cajita.id}
          cajita={fila.cajita}
          saldoCop={fila.saldoCop}
          movimientos={movimientos}
          onFijarSaldo={onFijarSaldo}
          onMovimiento={onMovimiento}
          onEliminar={onEliminar}
        />
      ))}
    </div>
  );
};
