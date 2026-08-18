import React, { useMemo, useState } from 'react';
import { AlertTriangle, X, Pencil, History, Plus, FileText } from 'lucide-react';
import type { Transaction } from './types';
import { COPY } from './copy';
import { byCategory, forMonth, monthTotals } from './lib/aggregate';
import { bogotaDate, monthKey, shiftMonth } from './lib/localDate';
import { nuevoId } from './lib/id';
import { movimientoEnBlanco, parseTransaction } from './lib/parseTransaction';
import type { ParsedTransaction } from './lib/parseTransaction';
import { ReporteFinancieroModal } from './components/ReporteFinancieroModal';
import { aprenderDe } from './lib/aprendizaje';
import { useAlmacen } from './data/useAlmacen';
import { useSesion } from './data/useSesion';
import { useTema } from './data/useTema';
import { obtenerSupabase } from './data/supabase';
import { RepositorioSupabase } from './data/repositorioSupabase';
import { LoginPanel } from './components/LoginPanel';
import { AnalistaView } from './components/AnalistaView';
import { AsesorView } from './components/AsesorView';
import { CajitasView } from './components/CajitasView';
import { ES_PASIVO } from './data/modelos';
import { ContactosView } from './components/ContactosView';
import { BuscadorMovimientos } from './components/BuscadorMovimientos';
import { PanelGmf } from './components/PanelGmf';
import { PanelRespaldo } from './components/PanelRespaldo';
import { PresupuestosView } from './components/PresupuestosView';
import { RecurrentesView } from './components/RecurrentesView';
import { useAjustesGmf } from './data/usePreferencias';
import { FILTRO_VACIO, filtrarMovimientos, filtroActivo } from './lib/filtros';
import type { Filtro } from './lib/filtros';
import { DudaContacto } from './components/DudaContacto';
import { contactoPorApodo, dudasDeUnion, partesDelLibro } from './lib/contactos';
import { useMostrarAhorro } from './data/usePreferencias';
import { DeudasView } from './components/DeudasView';
import { ConfiguracionView } from './components/ConfiguracionView';
import { PatrimonioCard } from './components/PatrimonioCard';
import { EstadoDelMes } from './components/EstadoDelMes';
import { DetalleMes } from './components/DetalleMes';
import { AnalisisMovimiento } from './components/AnalisisMovimiento';
import { crearIndiceSenales, senalesConIndice } from './lib/senales';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { ConfirmSheet } from './components/ConfirmSheet';
import type { ConfirmDraft } from './components/ConfirmSheet';
import { CatalogoProvider } from './catalogoContexto';
import { hacerCatalogo } from './categorias';
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
  cuentaId: tx.cuentaId,
  description: tx.description,
  raw: tx.rawTranscript,
  confidence: 1,
  confianzaGranular: {
    monto: 1,
    tipo: 1,
    categoria: 1,
    cuenta: 1,
    metodo: 1
  },
  needsReview: false,
  suggestedCategories: [tx.category, 'otros', 'comida', 'transporte'].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3),
  signals: {
    amountSource: 'digits',
    kindSource: 'keyword',
    categorySource: 'keyword',
    cuentaSource: 'ninguna',
    paymentMethod: 'desconocido',
    recurringPattern: 'ninguno',
    ambiguousAmount: false,
    destinatario: null,
    ubicacion: null,
    tags: [],
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
  const { mostrarAhorro, setMostrarAhorro } = useMostrarAhorro();
  const gmf = useAjustesGmf();
  const { transacciones, cajitas, cajitaMovimientos, metas, categorias } = almacen.datos;

  const [pending, setPending] = useState<ParsedTransaction | null>(null);
  const [editando, setEditando] = useState<Transaction | null>(null);
  const [analizando, setAnalizando] = useState<Transaction | null>(null);
  const [section, setSection] = useState<SectionId>('resumen');
  const [pestanaAhorro, setPestanaAhorro] = useState<PestanaAhorro>('cajitas');
  const [mostrarReporte, setMostrarReporte] = useState(false);

  const today = bogotaDate();
  const thisMonth = monthKey(today);
  const [month, setMonth] = useState(thisMonth);

  const { totals, gastos, ingresos, delMes } = useMemo(() => {
    const mes = forMonth(transacciones, month);
    const sorted = [...mes].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn));
    return {
      delMes: sorted,
      totals: monthTotals(mes),
      gastos: byCategory(mes, 'gasto'),
      ingresos: byCategory(mes, 'ingreso'),
    };
  }, [transacciones, month]);

  // Anywhere money of your own can sit: accounts and savings pockets alike.
  // Debts and cards are left out because paying one is not a transfer — it has
  // its own flow in Deudas, where the sign is inverted.
  const destinosDeTransferencia = useMemo(
    () =>
      cajitas
        .filter((c) => c.archivedAt === null && !ES_PASIVO[c.tipo])
        .map((c) => ({ id: c.id, nombre: c.nombre })),
    [cajitas],
  );

  // Bank accounts only — the field asks which ACCOUNT the money moved through.
  //
  // Debts and cards are not places money sits, and a savings pocket is not one
  // either: money reaches a cajita by being put there, which Ahorro already
  // records. Listing every balance made the picker a list of everything the app
  // knows rather than an answer to the question above it.
  const cuentasParaElegir = useMemo(
    () =>
      cajitas
        .filter((c) => c.archivedAt === null && c.tipo === 'cuenta')
        .map((c) => ({ id: c.id, nombre: c.nombre, esBajoMonto: c.esBajoMonto })),
    [cajitas],
  );

  // Computed once for the visible month rather than per row: each check scans
  // the whole ledger, so doing it inside the list would repeat that scan for
  // every movement on screen.
  const conSenal = useMemo(() => {
    const indice = crearIndiceSenales(transacciones);
    return new Set(
      delMes.filter((t) => senalesConIndice(t, indice).length > 0).map((t) => t.id),
    );
  }, [delMes, transacciones]);

  // Aprendido de todo el libro, no del mes visible: lo que archivaste en junio
  // también enseña. Se recalcula solo cuando cambian los movimientos, no en cada
  // tecla — el parseo ocurre al enviar, no mientras se escribe.
  const lexico = useMemo(() => aprenderDe(transacciones), [transacciones]);

  const cajitasBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    for (const mov of cajitaMovimientos) {
      balances[mov.cajitaId] = (balances[mov.cajitaId] || 0) + mov.deltaCop;
    }
    // Ingresos a cuenta suman, gastos de cuenta restan
    for (const tx of transacciones) {
      if (!tx.cuentaId) continue;
      const haciaArriba = tx.kind === 'ingreso';
      const sube = ES_PASIVO[cajitas.find(c => c.id === tx.cuentaId)?.tipo ?? 'cuenta'] ? !haciaArriba : haciaArriba;
      balances[tx.cuentaId] = (balances[tx.cuentaId] || 0) + (sube ? tx.amountCop : -tx.amountCop);
    }
    return balances;
  }, [cajitas, cajitaMovimientos, transacciones]);

  const handleSubmit = (text: string) => {
    const parseado = parseTransaction(text, cuentasParaElegir, categorias, lexico, transacciones);

    // Tú dices "le mandé 20 mil a mi pa" y en el libro queda "Wilson Gonzalez".
    // El apodo sirve para reconocer de quién hablas; el nombre completo es lo
    // que hay que dejar escrito, o dentro de un año la fila no dice nada.
    const quien = contactoPorApodo(text, almacen.datos.contactos);
    setPending(quien ? { ...parseado, description: quien.nombre } : parseado);
  };

  const handleSave = (draft: ConfirmDraft) => {
    void almacen.agregarTransaccion({
      id: nuevoId('tx'),
      kind: draft.kind,
      amountCop: draft.amountCop,
      category: draft.category,
      description: draft.description,
      occurredOn: draft.occurredOn || bogotaDate(),
      cuentaId: draft.cuentaId,
      rawTranscript: draft.rawTranscript,
      createdAt: new Date().toISOString(),
    });
    // Jump back to the month the entry landed in, so a save is never invisible
    // because the user was browsing an older month.
    const finalDate = draft.occurredOn || bogotaDate();
    setMonth(finalDate.slice(0, 7));
    setPending(null);
  };

  const handleUpdate = (draft: ConfirmDraft) => {
    if (!editando) return;
    // La fecha solo cambia si el selector devolvió una; si no, se respeta la
    // que ya tenía. Nunca se borra por accidente.
    const occurredOn = draft.occurredOn ?? editando.occurredOn;
    void almacen.actualizarTransaccion({
      ...editando,
      kind: draft.kind,
      amountCop: draft.amountCop,
      category: draft.category,
      description: draft.description,
      cuentaId: draft.cuentaId,
      occurredOn,
    });
    // Si el día se movió a otro mes, la fila desaparecería del mes en pantalla.
    // Saltar al mes donde quedó evita que la edición parezca haber borrado el
    // movimiento — el mismo motivo por el que guardar salta al mes de hoy.
    setMonth(monthKey(occurredOn));
    setEditando(null);
  };

  const monthNav = (
    <MonthNav month={month} onChange={setMonth} maxMonth={thisMonth} shift={shiftMonth} />
  );

  // Computed from the whole ledger, not the visible month: a spelling seen in
  // June and another in August are exactly the pair worth asking about.
  const dudaActual = useMemo(
    () => dudasDeUnion(partesDelLibro(transacciones), almacen.datos.contactos)[0] ?? null,
    [transacciones, almacen.datos.contactos],
  );

  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VACIO);
  // Built here as well as in the provider: the filter runs outside the tree the
  // provider wraps, and searching by category name needs the same resolution the
  // rows are drawn with.
  const catalogoActual = useMemo(() => hacerCatalogo(categorias), [categorias]);
  const sinFiltro = !filtroActivo(filtro);

  // The month is in charge until something is being searched for, and then the
  // search takes over the whole ledger. Anything else would mean stepping back
  // through the calendar to find one movement, which is the job a search box
  // exists to remove.
  const visibles = useMemo(
    () => (sinFiltro ? delMes : filtrarMovimientos(transacciones, filtro, catalogoActual)),
    [sinFiltro, delMes, transacciones, filtro, catalogoActual],
  );

  const registrar = (
    <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
      <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
        <Pencil className="h-4 w-4" strokeWidth={2.5} /> Registrar un movimiento
      </h2>
      <div className="mt-3">
        <DictationInput onSubmit={handleSubmit} />
      </div>

      {/* Deliberately small and below: dictating is the fast path this screen is
          built around, and a form of equal weight beside it would turn every
          entry into a choice. This is the way out for the movement the parser
          would fight — an odd amount, a date that is not today, nothing worth
          saying out loud. */}
      <button
        type="button"
        onClick={() => setPending(movimientoEnBlanco())}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-bold text-[var(--fin-ink-faint)] transition-colors hover:text-[var(--fin-ink)]"
      >
        <Plus className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
        O añádelo a mano
      </button>

      {/* One question at a time, right where movements get entered, and only
          when the app genuinely cannot tell. Answering either way settles it
          for good — a "no" is what stops the pair coming back. */}
      <DudaContacto
        duda={dudaActual}
        onUnir={(d) => void almacen.unirContactos(d.a.clave, d.b.clave, d.a.nombre)}
        onSeparar={(d) => void almacen.separarContactos(d.a.clave, d.b.clave, d.a.nombre)}
      />
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
    <CatalogoProvider categorias={categorias}>
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

          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">Resumen Ejecutivo</span>
            <button
              type="button"
              onClick={() => setMostrarReporte(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-1.5 text-xs font-bold text-[var(--fin-ink)] shadow-sm transition-all hover:bg-[var(--fin-soft)]"
            >
              <FileText className="h-3.5 w-3.5 text-blue-500" />
              Generar Informe / PDF
            </button>
          </div>

          <PatrimonioCard
            cajitas={cajitas}
            transacciones={transacciones}
            movimientos={cajitaMovimientos}
            onAgregar={() => setSection('cuentas')}
            mostrarAhorro={mostrarAhorro}
          />

          <EstadoDelMes totals={totals} delMes={delMes} mes={month} hoy={today} />

          <PresupuestosView
            presupuestos={almacen.datos.presupuestos}
            transacciones={transacciones}
            mes={month}
            hoy={today}
            onFijar={(cat, monto) => void almacen.fijarPresupuesto(cat, monto)}
            onQuitar={(cat) => void almacen.quitarPresupuesto(cat)}
          />

          <KpiRow totals={totals} />

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-5 min-w-0">
              {registrar}
              <CategoryBreakdown slices={gastos} title="En qué se te va" />
            </div>

            <div className="flex flex-col gap-5 min-w-0">
              <CategoryBreakdown slices={ingresos} title="De dónde entra" />

              <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
                <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
                  <History className="h-4 w-4" strokeWidth={2.5} /> Últimos movimientos
                </h2>
                <div className="mt-3">
                  <TransactionList
                    transactions={delMes.slice(0, 5)}
                    conSenal={conSenal}
                    onAnalizar={setAnalizando}
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
          {/* The month navigator disappears while a filter is on: it would be
              lying about what the list below shows, which is the whole ledger. */}
          {sinFiltro ? <div className="lg:hidden">{monthNav}</div> : null}
          {registrar}
          <BuscadorMovimientos
            filtro={filtro}
            onCambiar={setFiltro}
            resultados={visibles}
            cuentas={cuentasParaElegir}
          />
          <TransactionList
            transactions={visibles}
            conSenal={conSenal}
            onAnalizar={setAnalizando}
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
              tipo="cajita"
              cajitas={cajitas}
              transacciones={transacciones}
              movimientos={cajitaMovimientos}
              onCrear={(datos) => void almacen.crearCajita(datos)}
              onFijarSaldo={(cajitaId, saldo) => void almacen.fijarSaldo(cajitaId, saldo)}
              onMovimiento={(cajitaId, kind, deltaCop) =>
                void almacen.registrarMovimiento({ cajitaId, kind, deltaCop })
              }
              onEliminar={(id) => void almacen.borrarCajita(id)}
              destinos={destinosDeTransferencia}
              cuentasBancarias={cuentasParaElegir}
              onTransferir={(d) => void almacen.transferirEntreCuentas(d)}
              mostrarEnResumen={mostrarAhorro}
              onMostrarEnResumen={setMostrarAhorro}
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

      {section === 'cuentas' ? (
        <CajitasView
          tipo="cuenta"
          cajitas={cajitas}
          transacciones={transacciones}
          movimientos={cajitaMovimientos}
          onCrear={(datos) => void almacen.crearCajita(datos)}
          onFijarSaldo={(cajitaId, saldo) => void almacen.fijarSaldo(cajitaId, saldo)}
          onMovimiento={(cajitaId, kind, deltaCop) =>
            void almacen.registrarMovimiento({ cajitaId, kind, deltaCop })
          }
          onEliminar={(id) => void almacen.borrarCajita(id)}
          destinos={destinosDeTransferencia}
          cuentasBancarias={cuentasParaElegir}
          onTransferir={(d) => void almacen.transferirEntreCuentas(d)}
        />
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
          cuentas={cuentasParaElegir}
          onAbonar={(datos) => void almacen.abonarDeuda(datos)}
        />
      ) : null}

      {section === 'recurrentes' ? (
        <RecurrentesView
          recurrentes={almacen.datos.recurrentes}
          transacciones={transacciones}
          cuentas={cuentasParaElegir}
          mes={month}
          hoy={today}
          onCrear={(d) => void almacen.crearRecurrente(d)}
          onBorrar={(id) => void almacen.borrarRecurrente(id)}
          onConfirmar={(p) => void almacen.confirmarRecurrente(p)}
        />
      ) : null}

      {section === 'contactos' ? (
        <ContactosView
          transacciones={transacciones}
          contactos={almacen.datos.contactos}
          onUnir={(a, b, nombre) => void almacen.unirContactos(a, b, nombre)}
          onSeparar={(a, b, nombre) => void almacen.separarContactos(a, b, nombre)}
          onRenombrar={(c) => void almacen.actualizarContacto(c)}
          onDeshacer={(id) => void almacen.borrarContacto(id)}
          onApodar={(clave, nombre, apodo, quitar) =>
            void almacen.apodarParte(clave, nombre, apodo, quitar)
          }
        />
      ) : null}

      {section === 'configuracion' ? (
        <ConfiguracionView
          cajitas={cajitas}
          transacciones={transacciones}
          movimientos={cajitaMovimientos}
          onActualizar={(cajita) => void almacen.actualizarCajita(cajita)}
          onFijarSaldo={(cajitaId, saldo) => void almacen.fijarSaldo(cajitaId, saldo)}
          categorias={categorias}
          onCrearCategoria={(datos) => void almacen.crearCategoria(datos)}
          onActualizarCategoria={(c) => void almacen.actualizarCategoria(c)}
          onArchivarCategoria={(id) => void almacen.archivarCategoria(id)}
          onBorrarCategoria={(id) => void almacen.borrarCategoria(id)}
          panelGmf={
            <PanelGmf
              transacciones={transacciones}
              mes={month}
              anioActual={Number(bogotaDate().slice(0, 4))}
              cuentas={cuentasParaElegir}
              uvt={gmf.uvt}
              onCambiarUvt={gmf.setUvt}
              cuentasGmf={gmf.cuentasGmf}
              onCambiarCuentas={gmf.setCuentasGmf}
              regimen={gmf.regimen}
              onCambiarRegimen={gmf.setRegimen}
              cuentaExentaId={gmf.cuentaExentaId}
              onCambiarCuentaExenta={gmf.setCuentaExentaId}
            />
          }
          panelRespaldo={
            <PanelRespaldo
              datos={almacen.datos}
              hoy={today}
              onRestaurar={(d) => void almacen.restaurar(d)}
            />
          }
        />
      ) : null}

      {section === 'analista' ? (
        <AnalistaView
          existentes={transacciones}
          onImportar={(nuevos) => void almacen.importarTransacciones(nuevos)}
        />
      ) : null}

      {section === 'asesor' ? (
        <AsesorView 
          transacciones={transacciones}
          cajitas={cajitas}
          cajitasBalances={cajitasBalances}
          categorias={categorias}
          lexico={lexico}
          onCrearTransaccion={(tx) => setPending(tx)}
        />
      ) : null}

      {/* Confirmation always gates the write — see ConfirmSheet for why. */}
      {pending ? (
        <ConfirmSheet
          parsed={pending}
          cuentas={cuentasParaElegir}
          onSave={handleSave}
          onCancel={() => setPending(null)}
        />
      ) : null}

      {analizando ? (
        <AnalisisMovimiento
          tx={analizando}
          historial={transacciones}
          onCerrar={() => setAnalizando(null)}
        />
      ) : null}

      {editando ? (
        <ConfirmSheet
          modo="editar"
          parsed={comoParseado(editando)}
          cuentas={cuentasParaElegir}
          cuentaInicial={editando.cuentaId}
          fechaInicial={editando.occurredOn}
          fechaMax={today}
          onSave={handleUpdate}
          onCancel={() => setEditando(null)}
        />
      ) : null}

      <ReporteFinancieroModal
        abierto={mostrarReporte}
        onCerrar={() => setMostrarReporte(false)}
        mes={month}
        datos={almacen.datos}
        cajitasBalances={cajitasBalances}
        emailUsuario={cuenta?.email}
      />
    </FinanzasShell>
    </CatalogoProvider>
  );
};
