import React, { useMemo, useState } from 'react';
import { AlertTriangle, X, Pencil, History } from 'lucide-react';
import type { Transaction } from './types';
import { COPY } from './copy';
import { byCategory, forMonth, monthTotals } from './lib/aggregate';
import { bogotaDate, monthKey, shiftMonth } from './lib/localDate';
import { nuevoId } from './lib/id';
import { parseTransaction } from './lib/parseTransaction';
import type { ParsedTransaction } from './lib/parseTransaction';
import { useAlmacen } from './data/useAlmacen';
import { useSesion } from './data/useSesion';
import { useTema } from './data/useTema';
import { obtenerSupabase } from './data/supabase';
import { RepositorioSupabase } from './data/repositorioSupabase';
import { LoginPanel } from './components/LoginPanel';
import { AnalistaView } from './components/AnalistaView';
import { CajitasView } from './components/CajitasView';
import { DeudasView } from './components/DeudasView';
import { ConfiguracionView } from './components/ConfiguracionView';
import { PatrimonioCard } from './components/PatrimonioCard';
import { DetalleMes } from './components/DetalleMes';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { ConfirmSheet } from './components/ConfirmSheet';
import type { ConfirmDraft } from './components/ConfirmSheet';
import { DictationInput } from './components/DictationInput';
import { FinanzasShell } from './components/FinanzasShell';
import { TemaToggle } from './components/TemaToggle';
import { MetasView } from './components/MetasView';
import { PESTANAS_AHORRO } from './sections';
import type { PestanaAhorro, SectionId } from './sections';
import type { Tema } from './data/useTema';
import { KpiRow } from './components/KpiRow';
import { MonthNav } from './components/MonthNav';
import { TendenciasView } from './components/TendenciasView';
import { TransactionList } from './components/TransactionList';
import './finanzas.css';

/**
 * Rebuilds the parser's output shape from a stored row so editing can reuse
 * ConfirmSheet untouched. Everything is reported as high confidence because the
 * user already confirmed these values once — nothing here was guessed just now.
 */
const comoParseado = (tx: Transaction): ParsedTransaction => ({
  kind: tx.kind,
  amount: tx.amountCop,
  category: tx.category,
  description: tx.description,
  raw: tx.rawTranscript,
  confidence: 1,
  needsReview: false,
  signals: {
    amountSource: 'digits',
    kindSource: 'keyword',
    categorySource: 'keyword',
    ambiguousAmount: false,
  },
});

/**
 * Chooses how the app is reached before it renders anything.
 *
 * Three outcomes, and the local one matters most: with no Supabase project
 * configured the tool must still work exactly as it does today, on device
 * storage and with no login wall it has no way to satisfy.
 */
export interface FinanzasAppProps {
  onBack?: () => void;
}

export const FinanzasApp: React.FC<FinanzasAppProps> = ({ onBack }) => {
  const sesion = useSesion();
  const { tema, setTema } = useTema();

  if (sesion.estado.modo === 'cargando') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--fin-bg)]">
        <p className="text-sm font-bold text-[var(--fin-ink-faint)]">{COPY.almacen.cargando}</p>
      </div>
    );
  }

  if (sesion.estado.modo === 'anonimo') {
    return <LoginPanel sesion={sesion} tema={tema} onCambiarTema={setTema} />;
  }

  const cuenta =
    sesion.estado.modo === 'autenticado'
      ? { email: sesion.estado.email, onSalir: () => void sesion.salir() }
      : undefined;

  return (
    <FinanzasPanel
      // Remounts on account change, so one user's data can never be left on
      // screen under another's session.
      key={sesion.estado.modo === 'autenticado' ? sesion.estado.userId : 'local'}
      userId={sesion.estado.modo === 'autenticado' ? sesion.estado.userId : null}
      cuenta={cuenta}
      tema={tema}
      onCambiarTema={setTema}
      onBack={onBack}
    />
  );
};

interface FinanzasPanelProps {
  /** Null in local mode, where storage is this device's IndexedDB. */
  userId: string | null;
  cuenta?: { email: string; onSalir: () => void };
  tema: Tema;
  onCambiarTema: (tema: Tema) => void;
  onBack?: () => void;
}

const FinanzasPanel: React.FC<FinanzasPanelProps> = ({ userId, cuenta, tema, onCambiarTema, onBack }) => {
  const repositorio = useMemo(() => {
    if (!userId) return undefined;
    const cliente = obtenerSupabase();
    return cliente ? new RepositorioSupabase(cliente, userId) : undefined;
  }, [userId]);

  const almacen = useAlmacen(repositorio);
  const { transacciones, cajitas, cajitaMovimientos, metas } = almacen.datos;

  const [pending, setPending] = useState<ParsedTransaction | null>(null);
  const [editando, setEditando] = useState<Transaction | null>(null);
  const [section, setSection] = useState<SectionId>('resumen');
  const [pestanaAhorro, setPestanaAhorro] = useState<PestanaAhorro>('cajitas');

  const today = bogotaDate();
  const thisMonth = monthKey(today);
  const [month, setMonth] = useState(thisMonth);

  const { totals, gastos, ingresos, delMes } = useMemo(() => {
    const mes = forMonth(transacciones, month);
    return {
      delMes: mes,
      totals: monthTotals(mes),
      gastos: byCategory(mes, 'gasto'),
      ingresos: byCategory(mes, 'ingreso'),
    };
  }, [transacciones, month]);

  const handleSubmit = (text: string) => setPending(parseTransaction(text));

  const handleSave = (draft: ConfirmDraft) => {
    void almacen.agregarTransaccion({
      id: nuevoId('tx'),
      kind: draft.kind,
      amountCop: draft.amountCop,
      category: draft.category,
      description: draft.description,
      occurredOn: bogotaDate(),
      rawTranscript: draft.rawTranscript,
      createdAt: new Date().toISOString(),
    });
    // Jump back to the month the entry landed in, so a save is never invisible
    // because the user was browsing an older month.
    setMonth(thisMonth);
    setPending(null);
  };

  const handleUpdate = (draft: ConfirmDraft) => {
    if (!editando) return;
    void almacen.actualizarTransaccion({
      ...editando,
      kind: draft.kind,
      amountCop: draft.amountCop,
      category: draft.category,
      description: draft.description,
    });
    setEditando(null);
  };

  const monthNav = (
    <MonthNav month={month} onChange={setMonth} maxMonth={thisMonth} shift={shiftMonth} />
  );

  const registrar = (
    <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
        <Pencil className="h-4 w-4" strokeWidth={2.5} /> Registrar un movimiento
      </h2>
      <div className="mt-3">
        <DictationInput onSubmit={handleSubmit} />
      </div>
    </section>
  );

  const conBarraDeMes = section === 'resumen' || section === 'movimientos';

  if (almacen.cargando) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--fin-bg)]">
        <p className="text-sm font-bold text-[var(--fin-ink-faint)]">{COPY.almacen.cargando}</p>
      </div>
    );
  }

  return (
    <FinanzasShell
      section={section}
      onSectionChange={setSection}
      toolbar={conBarraDeMes ? monthNav : undefined}
      cuenta={cuenta}
      temaToggle={<TemaToggle tema={tema} onCambiar={onCambiarTema} />}
      onBack={onBack}
    >
      {/* Storage that cannot remember has to say so — silently losing a month of
          entries is far worse than an ugly banner. */}
      {!almacen.persistente ? (
        <div className="mx-auto mb-4 flex max-w-6xl items-start gap-2.5 rounded-2xl bg-[var(--fin-warn-bg)] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-warn)]" strokeWidth={3} />
          <p className="text-[11px] leading-relaxed text-[var(--fin-warn-ink)]">
            {COPY.almacen.sinPersistencia}
          </p>
        </div>
      ) : null}

      {almacen.error ? (
        <div className="mx-auto mb-4 flex max-w-6xl items-start gap-2.5 rounded-2xl bg-[var(--fin-out-bg)] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-out)]" strokeWidth={3} />
          <p className="flex-1 text-[11px] leading-relaxed text-[var(--fin-out-ink)]">{almacen.error}</p>
          <button
            type="button"
            onClick={almacen.descartarError}
            aria-label={COPY.almacen.descartar}
            className="shrink-0 rounded-lg p-1 text-[var(--fin-out-ink)]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </div>
      ) : null}

      {section === 'resumen' ? (
        // Mobile stacks; from `lg` the same blocks become a two-column dashboard
        // with the KPI row spanning the full width above them.
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
          <div className="lg:hidden">{monthNav}</div>

          <PatrimonioCard
            cajitas={cajitas}
            movimientos={cajitaMovimientos}
            onAgregar={() => {
              setPestanaAhorro('cajitas');
              setSection('ahorro');
            }}
          />

          <KpiRow totals={totals} />

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              {registrar}
              <CategoryBreakdown slices={gastos} title="En qué se te va" />
            </div>

            <div className="flex flex-col gap-5">
              <CategoryBreakdown slices={ingresos} title="De dónde entra" />

              <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
                <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
                  <History className="h-4 w-4" strokeWidth={2.5} /> Últimos movimientos
                </h2>
                <div className="mt-3">
                  <TransactionList
                    transactions={delMes.slice(0, 5)}
                    onDelete={(id) => void almacen.borrarTransaccion(id)}
                    onEdit={setEditando}
                  />
                </div>
              </section>
            </div>
          </div>

          <DetalleMes delMes={delMes} transacciones={transacciones} mes={month} />
        </div>
      ) : null}

      {section === 'movimientos' ? (
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <div className="lg:hidden">{monthNav}</div>
          {registrar}
          <TransactionList
            transactions={delMes}
            onDelete={(id) => void almacen.borrarTransaccion(id)}
            onEdit={setEditando}
          />
        </div>
      ) : null}

      {section === 'tendencias' ? (
        <TendenciasView transacciones={transacciones} mes={month} />
      ) : null}

      {section === 'ahorro' ? (
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--fin-soft)] p-1.5">
            {PESTANAS_AHORRO.map((pestana) => {
              const activa = pestanaAhorro === pestana.id;
              return (
                <button
                  key={pestana.id}
                  type="button"
                  onClick={() => setPestanaAhorro(pestana.id)}
                  aria-pressed={activa}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors ${
                    activa ? 'bg-[var(--fin-card)] text-[var(--fin-ink)]' : 'text-[var(--fin-ink-soft)]'
                  }`}
                >
                  <pestana.icon className={`h-4 w-4 shrink-0 ${activa ? pestana.color : ''}`} aria-hidden="true" />
                  {pestana.label}
                </button>
              );
            })}
          </div>

          {pestanaAhorro === 'cajitas' ? (
            <CajitasView
              cajitas={cajitas}
              movimientos={cajitaMovimientos}
              onCrear={(datos) => void almacen.crearCajita(datos)}
              onFijarSaldo={(cajitaId, saldo) => void almacen.fijarSaldo(cajitaId, saldo)}
              onMovimiento={(cajitaId, kind, deltaCop) =>
                void almacen.registrarMovimiento({ cajitaId, kind, deltaCop })
              }
              onEliminar={(id) => void almacen.borrarCajita(id)}
            />
          ) : (
            <MetasView
              metas={metas}
              cajitas={cajitas}
              movimientos={cajitaMovimientos}
              onCrear={(datos) => void almacen.crearMeta(datos)}
              onActualizar={(meta) => void almacen.actualizarMeta(meta)}
              onEliminar={(id) => void almacen.borrarMeta(id)}
            />
          )}
        </div>
      ) : null}

      {section === 'deudas' ? (
        <DeudasView
          cajitas={cajitas}
          movimientos={cajitaMovimientos}
          onCrear={(datos) => void almacen.crearCajita(datos)}
          onFijarSaldo={(cajitaId, saldo) => void almacen.fijarSaldo(cajitaId, saldo)}
          onMovimiento={(cajitaId, kind, deltaCop, categoria) =>
            void almacen.registrarMovimiento({ cajitaId, kind, deltaCop, categoria })
          }
          onEliminar={(id) => void almacen.borrarCajita(id)}
        />
      ) : null}

      {section === 'configuracion' ? (
        <ConfiguracionView
          cajitas={cajitas}
          movimientos={cajitaMovimientos}
          onActualizar={(cajita) => void almacen.actualizarCajita(cajita)}
          onFijarSaldo={(cajitaId, saldo) => void almacen.fijarSaldo(cajitaId, saldo)}
        />
      ) : null}

      {section === 'analista' ? (
        <AnalistaView
          existentes={transacciones}
          onImportar={(nuevos) => void almacen.importarTransacciones(nuevos)}
        />
      ) : null}

      {/* Confirmation always gates the write — see ConfirmSheet for why. */}
      {pending ? (
        <ConfirmSheet parsed={pending} onSave={handleSave} onCancel={() => setPending(null)} />
      ) : null}

      {editando ? (
        <ConfirmSheet
          modo="editar"
          parsed={comoParseado(editando)}
          onSave={handleUpdate}
          onCancel={() => setEditando(null)}
        />
      ) : null}
    </FinanzasShell>
  );
};
