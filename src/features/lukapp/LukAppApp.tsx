import React, { useCallback, useMemo, useState } from 'react';
import './styles/premium-effects.css';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CloudOff, X } from 'lucide-react';
import type { Transaction } from './types';
import { COPY } from './copy';
import { byCategory, forMonth, monthTotals } from './lib/aggregate';
import { totalVisible, saldoEfectivo, saldoCuentasSinEfectivo } from './lib/cajitas';
import { formatCop } from './lib/formatCop';
import { bogotaDate, monthKey, shiftMonth } from './lib/localDate';
import { nuevoId } from './lib/id';
import { movimientoEnBlanco, parseTransaction } from './lib/parseTransaction';
import type { ParsedTransaction } from './lib/parseTransaction';
import { ReporteFinancieroModal } from './components/ReporteFinancieroModal';
import { aprenderDe } from './lib/aprendizaje';
import { useAlmacen } from './data/useAlmacen';
import { useSincronizacion } from './data/useSincronizacion';
import { useSesion } from './data/useSesion';
import { useTema } from './data/useTema';
import { obtenerSupabase } from './data/supabase';
import { RepositorioSupabase } from './data/repositorioSupabase';
import { RepositorioIndexedDB, soportaIndexedDB } from './data/indexeddb';
import { RepositorioConCola } from './data/repositorioConCola';
import { ColaCambios } from './data/colaCambios';
import { LoginPanel } from './components/LoginPanel';
import { AnalistaView } from './components/AnalistaView';
import { AsesorView } from './components/AsesorView';
import { ES_PASIVO } from './data/modelos';
import { ContactosView } from './components/ContactosView';
import { BuscadorMovimientos } from './components/BuscadorMovimientos';
import { PanelAtajos } from './components/PanelAtajos';
import { PanelGmf } from './components/PanelGmf';
import { PanelRespaldo } from './components/PanelRespaldo';
import { PresupuestosView } from './components/PresupuestosView';
import { RecurrentesView } from './components/RecurrentesView';
import { useAjustesGmf } from './data/usePreferencias';
import { FILTRO_VACIO, filtrarMovimientos, filtroActivo } from './lib/filtros';
import type { Filtro } from './lib/filtros';
import { contactoPorApodo } from './lib/contactos';
import {
  useGuiaApp,
  useMostrarAhorro,
  useMostrarEfectivoSeparado,
  useOnboarding,
} from './data/usePreferencias';
import { ConfiguracionView } from './components/ConfiguracionView';
import { CategoriasEditor } from './components/CategoriasEditor';
import { AnalisisMovimiento } from './components/AnalisisMovimiento';
import { crearIndiceSenales, senalesConIndice } from './lib/senales';
import { analizarAnomalias } from './lib/senalesAvanzadas';
import { ConfirmSheet } from './components/ConfirmSheet';
import type { ConfirmDraft } from './components/ConfirmSheet';
import { CatalogoProvider } from './catalogoContexto';
import { hacerCatalogo } from './categorias';
import { CajitasView } from './components/CajitasView';
import { DeudasView } from './components/DeudasView';
import { MetasView } from './components/MetasView';
import { LukAppShell } from './components/LukAppShell';
import { InicioView } from './components/InicioView';
import { insightsDelMes } from './lib/insights';
import { DineroView } from './components/DineroView';
import { DetalleCajita } from './components/DetalleCajita';
import { MesView } from './components/MesView';
import { AjustesView } from './components/AjustesView';
import { PasswordRecoveryView } from './components/PasswordRecoveryView';
import { HojaPanel } from './components/HojaPanel';
import { Captura } from './components/Captura';
import { BotonAnotar } from './components/BotonAnotar';
import { DetalleMovimiento } from './components/DetalleMovimiento';
import { AvisoGuardado } from './components/AvisoGuardado';
import type { Guardado } from './components/AvisoGuardado';
import { Onboarding } from './components/Onboarding';
import { PANELES_AJUSTES, SECTIONS } from './sections';
import { BASE_LUKAPP, segmentosDe, useRuta } from './data/useRuta';
import type { PanelAjustes, SectionId } from './sections';
import { TemaToggle } from './components/TemaToggle';
import type { Tema } from './data/useTema';
import { TransactionList } from './components/TransactionList';
import { GuiaApp } from './components/guia/GuiaApp';
import { PASOS_BASICOS, PASOS_POR_SECCION } from './components/guia/pasos';
import './lukapp.css';

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
    metodo: 1,
  },
  needsReview: false,
  suggestedCategories: [tx.category, 'otros', 'comida', 'transporte']
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3),
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

/** Las cosas que se abren encima de la pantalla actual. */
type Capa = 'buscar' | null;

/**
 * Chooses how the app is reached before it renders anything.
 *
 * Three outcomes, and the local one matters most: with no Supabase project
 * configured the tool must still work exactly as it does today, on device
 * storage and with no login wall it has no way to satisfy.
 */
export interface LukAppMainProps {
  onBack?: () => void;
}

export const LukAppMain: React.FC<LukAppMainProps> = ({ onBack }) => {
  const sesion = useSesion();
  const { tema, setTema } = useTema();

  if (sesion.estado.modo === 'cargando') {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--fin-bg)]">
        <p className="text-[17px] font-semibold text-[var(--fin-ink-faint)]">
          {COPY.almacen.cargando}
        </p>
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
    <LukAppPanel
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

interface LukAppPanelProps {
  /** Null in local mode, where storage is this device's IndexedDB. */
  userId: string | null;
  cuenta?: { email: string; onSalir: () => void };
  tema: Tema;
  onCambiarTema: (tema: Tema) => void;
  onBack?: () => void;
}

const LukAppPanel: React.FC<LukAppPanelProps> = ({
  userId,
  cuenta,
  tema,
  onCambiarTema,
  onBack,
}) => {
  const repositorio = useMemo(() => {
    if (!userId) return undefined;
    const cliente = obtenerSupabase();
    if (!cliente) return undefined;
    const remoto = new RepositorioSupabase(cliente, userId);

    // Sin IndexedDB (Firefox en modo privado lo rechaza de plano) no hay dónde
    // guardar una cola: se sigue hablando con Supabase directo, como siempre.
    // Sin conexión, eso vuelve a fallar como antes de este cambio — no hay
    // forma de hacerlo mejor sin un sitio persistente donde anotar lo pendiente.
    if (!soportaIndexedDB()) return remoto;

    // Nombre propio POR USUARIO: nunca el mismo `finanzas` del modo local, y
    // nunca compartido entre dos cuentas distintas en el mismo aparato. Si hoy
    // usas la app sin cuenta y mañana entras con una, o si otra persona entra
    // con la suya en este mismo computador, cada quien tiene su propia base y
    // ninguna ve ni un dato de la otra.
    const nombreDeCache = `finanzas-nube-${userId}`;
    const local = new RepositorioIndexedDB(nombreDeCache);
    const cola = new ColaCambios(nombreDeCache);
    return new RepositorioConCola(local, remoto, cola);
  }, [userId]);

  const almacen = useAlmacen(repositorio);

  // Vuelve a leer cada vez que regresas a la app. Sin esto, la app instalada en
  // la pantalla de inicio se queda con la foto del momento en que se abrió, y
  // lo que anotaste en el computador no aparece hasta cerrarla del todo.
  //
  // Va activo SIEMPRE, también sin cuenta. Con cuenta, el otro escritor es otro
  // aparato; sin cuenta, es otra pestaña del mismo navegador, que comparte la
  // misma base local. Dos pestañas abiertas mostrando saldos distintos es el
  // mismo problema, y leer de la base local no cuesta ni un viaje a internet.
  useSincronizacion({ activo: true, recargar: almacen.recargar });
  const { mostrarAhorro, setMostrarAhorro } = useMostrarAhorro();
  const { mostrarEfectivoSeparado, setMostrarEfectivoSeparado } = useMostrarEfectivoSeparado();
  const onboarding = useOnboarding();
  const gmf = useAjustesGmf();
  const { transacciones, cajitas, cajitaMovimientos, categorias } = almacen.datos;

  const [pending, setPending] = useState<ParsedTransaction | null>(null);
  const [editando, setEditando] = useState<Transaction | null>(null);
  const [analizando, setAnalizando] = useState<Transaction | null>(null);
  // Una sola variable de navegación. Antes eran tres a la vez (la sección, la
  // pestaña de Ahorro y la de Configuración), y de ahí salían estados
  // imposibles: quedarte en una pestaña que en ese ancho de pantalla ni
  // siquiera se dibujaba, sin forma de volver.
  // La sección y el panel abierto salen de la URL, no de un useState suelto:
  // así /finanzas/movimientos y /finanzas/ajustes/cuentas son enlazables, el
  // atrás del navegador retrocede dentro de la app y recargar no te devuelve
  // al inicio.
  const { ruta, ir } = useRuta();
  const segmentos = segmentosDe(ruta);
  const section: SectionId = (() => {
    const s = SECTIONS.find((x) => x.id === segmentos[0]);
    return s ? (s.id as SectionId) : 'inicio';
  })();
  const setSection = useCallback(
    (destino: SectionId) =>
      ir(destino === 'inicio' ? `${BASE_LUKAPP}/app` : `${BASE_LUKAPP}/${destino}`),
    [ir],
  );
  const [mostrarReporte, setMostrarReporte] = useState(false);
  const guia = useGuiaApp();

  /* CUÁNDO SALE LA GUÍA
     El recorrido básico espera a que termine la bienvenida: mientras esa está
     abierta tapa la pantalla entera, así que iluminar el saldo por debajo no
     señalaría nada. Después, los globos de cada sitio salen solos la primera
     vez que se entra, y solo cuando el básico ya pasó — llegar a Dinero con dos
     capas de explicación encima es exactamente lo que se quería evitar. */
  const guiaBasicaAbierta = onboarding.terminado && !guia.basicaVista;
  const pasoDeSeccion = PASOS_POR_SECCION[section];
  const guiaSeccionAbierta =
    onboarding.terminado &&
    guia.basicaVista &&
    pasoDeSeccion !== undefined &&
    !guia.seccionesVistas.includes(section);

  // La hoja de anotar se dibuja encima, sin bloquear el scroll de detrás, así
  // que al cerrarse devuelve la página donde estuviera. Al volver de anotar lo
  // que se quiere ver es el total y el movimiento recién guardado, y los dos
  // están arriba del todo.
  const cerrarCaptura = useCallback(() => {
    setPending(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
    return new Set(delMes.filter((t) => senalesConIndice(t, indice).length > 0).map((t) => t.id));
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
      const sube = ES_PASIVO[cajitas.find((c) => c.id === tx.cuentaId)?.tipo ?? 'cuenta']
        ? !haciaArriba
        : haciaArriba;
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
    const id = nuevoId('tx');
    void almacen.agregarTransaccion({
      id,
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
    cerrarCaptura();

    // El aviso de "quedó guardado", con Deshacer. Antes guardar no decía nada:
    // la hoja se cerraba y uno se quedaba sin saber si había quedado.
    //
    // Y aquí es donde va el aviso de "esto es más caro de lo normal". Antes
    // salía JUSTO ENCIMA del botón de guardar, o sea frenando a la persona en
    // el último segundo por algo que casi siempre estaba bien. Es un dato útil,
    // pero no es motivo para parar: se cuenta después, al lado del Deshacer,
    // que es lo único que sirve de verdad si resultó estar mal.
    const anomalia = analizarAnomalias(transacciones, draft.category, draft.amountCop);
    setGuardado({
      id,
      texto: `${draft.description} · ${formatCop(draft.amountCop)}`,
      aviso: anomalia?.esAnomalía
        ? `Más de lo normal — sueles gastar ${formatCop(anomalia.promedio)} aquí.`
        : null,
    });
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

  // ---------------------------------------------------------------- capas ---
  // Las cosas que se abren ENCIMA de la pantalla, no en vez de ella. Antes casi
  // todas eran secciones con su propio puesto en el menú; ahora son capas, que
  // es lo que siempre fueron: sitios de los que uno sale, no en los que vive.
  const [capa, setCapa] = useState<Capa>(null);
  const panelAjustes: PanelAjustes | null =
    section === 'ajustes' && segmentos[1]
      ? (PANELES_AJUSTES.find((p) => p.id === segmentos[1])?.id as PanelAjustes) ?? null
      : null;
  const setPanelAjustes = useCallback(
    (panel: PanelAjustes | null) =>
      ir(panel ? `${BASE_LUKAPP}/ajustes/${panel}` : `${BASE_LUKAPP}/ajustes`),
    [ir],
  );
  // Qué grupo de "Dinero" se abrió. La lista de Dinero es solo el resumen; las
  // acciones de verdad (crear, transferir, aportar, abonar) siguen viviendo en
  // las vistas de siempre, que se abren desde aquí. Así la pantalla nueva es
  // más limpia sin que se pierda nada de lo que la app sabía hacer.
  const [panelDinero, setPanelDinero] = useState<'cuenta' | 'cajita' | 'deuda' | null>(null);
  const [panelDineroCajitaId, setPanelDineroCajitaId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Transaction | null>(null);
  const [guardado, setGuardado] = useState<Guardado | null>(null);

  const nombreDeCuenta = (id: string | null) =>
    id === null ? null : (cajitas.find((c) => c.id === id)?.nombre ?? null);

  // La cuenta que se usa cuando no dices ninguna. Antes esto era un desplegable
  // de 117px en el formulario, y la respuesta era la misma el 95% de las veces.
  const cuentaPorDefecto = cuentasParaElegir[0]?.id ?? null;

  // "Para ti": lo que la app nota por su cuenta. Todo se calcula en local —ver
  // lib/insights.ts sobre por qué nunca se le pide esto a un modelo— y aquí
  // solo se traduce a lo que la pantalla necesita: un sitio a donde ir al
  // tocarlo.
  const paraTi = useMemo(
    () =>
      insightsDelMes(
        transacciones,
        almacen.datos.presupuestos,
        month,
        bogotaDate(),
        (categoria) => catalogoActual.de(categoria).nombre,
      ).map((insight) => ({
        ...insight,
        onTocar: insight.seccion ? () => setSection(insight.seccion as SectionId) : undefined,
      })),
    [transacciones, almacen.datos.presupuestos, month, catalogoActual, setSection],
  );

  const patrimonioCop = useMemo(
    () => totalVisible(cajitas, cajitaMovimientos, transacciones, mostrarAhorro),
    [cajitas, cajitaMovimientos, transacciones, mostrarAhorro],
  );

  const saldoEfectivoCop = useMemo(
    () => saldoEfectivo(cajitas, cajitaMovimientos, transacciones),
    [cajitas, cajitaMovimientos, transacciones],
  );

  const saldoCuentasSinEfectivoCop = useMemo(
    () => saldoCuentasSinEfectivo(cajitas, cajitaMovimientos, transacciones),
    [cajitas, cajitaMovimientos, transacciones],
  );

  if (almacen.cargando) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--fin-bg)]">
        <p className="text-[15px] text-[var(--fin-ink-faint)]">{COPY.almacen.cargando}</p>
      </div>
    );
  }

  return (
    <CatalogoProvider categorias={categorias}>
      <LukAppShell
        section={section}
        onSectionChange={setSection}
        onBack={onBack}
        accion={
          <BotonAnotar
            onDictado={handleSubmit}
            onManual={() => setPending(movimientoEnBlanco())}
            onBuscar={() => setCapa('buscar')}
          />
        }
      >
        {/* Storage that cannot remember has to say so — silently losing a month of
 entries is far worse than an ugly banner. */}
        {!almacen.persistente ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] px-4 py-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-warn)]"
              strokeWidth={2.5}
            />
            <p className="text-[13px] leading-relaxed text-[var(--fin-warn-ink)]">
              {COPY.almacen.sinPersistencia}
            </p>
          </div>
        ) : null}

        {/* Anotaste algo sin señal: se ve de una en el aparato, pero le falta
            subir. El aviso desaparece solo en cuanto vuelve la conexión y la
            cola se vacía — no hace falta que la persona haga nada. */}
        {almacen.cambiosPendientes > 0 ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] px-4 py-3">
            <CloudOff
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-warn)]"
              strokeWidth={2.5}
            />
            <p className="text-[13px] leading-relaxed text-[var(--fin-warn-ink)]">
              {almacen.cambiosPendientes === 1
                ? 'Tienes 1 cambio sin subir. Se sube solo en cuanto vuelva la conexión.'
                : `Tienes ${almacen.cambiosPendientes} cambios sin subir. Se suben solos en cuanto vuelva la conexión.`}
            </p>
          </div>
        ) : null}

        {almacen.error ? (
          <div className="mb-4 flex items-start gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] px-4 py-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-out)]"
              strokeWidth={2.5}
            />
            <p className="flex-1 text-[13px] leading-relaxed text-[var(--fin-out-ink)]">
              {almacen.error}
            </p>
            <button
              type="button"
              onClick={almacen.descartarError}
              aria-label={COPY.almacen.descartar}
              className="shrink-0 rounded-[var(--fin-r-control)] p-1 text-[var(--fin-out-ink)]"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        ) : null}

        {/* Transición entre las 5 secciones principales (Inicio/Dinero/Mes/
 Asesor/Ajustes): el key={section} hace que AnimatePresence trate cada
 cambio de sección como un montaje/desmontaje real, con un pequeño
 slide+fade en vez del corte seco de antes. */}
        <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={section}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
        {/* ------------------------------------------------------- 1. Inicio --- */}
        {section === 'inicio' ? (
          <InicioView
            month={month}
            onCambiarMes={() => setSection('mes')}
            onBuscar={() => setCapa('buscar')}
            onAjustes={() => setSection('ajustes')}
            patrimonioCop={patrimonioCop}
            gastosCop={totals.gastos}
            ingresosCop={totals.ingresos}
            onVerMes={() => setSection('mes')}
            movimientos={delMes}
            conSenal={conSenal}
            onAbrirMovimiento={setDetalle}
            insights={paraTi}
            mostrarEfectivoSeparado={mostrarEfectivoSeparado}
            saldoEfectivoCop={saldoEfectivoCop}
            saldoCuentasSinEfectivoCop={saldoCuentasSinEfectivoCop}
          />
        ) : null}

        {/* ------------------------------------------------------- 2. Dinero --- */}
        {section === 'dinero' ? (
          <DineroView
            transacciones={transacciones}
            cajitas={cajitas}
            movimientos={cajitaMovimientos}
            mostrarAhorro={mostrarAhorro}
            onAbrir={(cajita) => {
              setPanelDineroCajitaId(cajita.id);
              setPanelDinero(
                ES_PASIVO[cajita.tipo] ? 'deuda' : cajita.tipo === 'cajita' ? 'cajita' : 'cuenta',
              );
            }}
            onCrear={() => {
              setPanelDineroCajitaId(null);
              setPanelDinero('cuenta');
            }}
          />
        ) : null}

        {/* ---------------------------------------------------------- 3. Mes --- */}
        {section === 'mes' ? (
          <MesView
            month={month}
            maxMonth={thisMonth}
            hoy={today}
            onCambiarMes={setMonth}
            shift={shiftMonth}
            totals={totals}
            gastos={gastos}
            ingresos={ingresos}
            delMes={delMes}
            transacciones={transacciones}
            topes={
              <PresupuestosView
                presupuestos={almacen.datos.presupuestos}
                transacciones={transacciones}
                mes={month}
                hoy={today}
                onFijar={(categoria, montoCop) =>
                  void almacen.fijarPresupuesto(categoria, montoCop)
                }
                onQuitar={(categoria) => void almacen.quitarPresupuesto(categoria)}
                onNuevaTransaccion={(categoria) =>
                  setPending({ ...movimientoEnBlanco(), category: categoria })
                }
              />
            }
          />
        ) : null}

        {/* -------------------------------------------------------- 4. Asesor --- */}
        {section === 'asesor' ? (
          <AsesorView
            transacciones={transacciones}
            cajitas={cajitas}
            cajitasBalances={cajitasBalances}
            categorias={categorias}
            lexico={lexico}
            onCrearTransaccion={(tx) => {
              setSection('inicio');
              setPending(tx);
            }}
          />
        ) : null}

        {/* ------------------------------------------------------ 5. Ajustes --- */}
        {section === 'ajustes' ? (
          <AjustesView
            onAbrir={setPanelAjustes}
            temaToggle={<TemaToggle tema={tema} onCambiar={onCambiarTema} />}
            cuenta={cuenta}
            mostrarAhorro={mostrarAhorro}
            onMostrarAhorro={setMostrarAhorro}
            mostrarEfectivoSeparado={mostrarEfectivoSeparado}
            onMostrarEfectivoSeparado={setMostrarEfectivoSeparado}
            onVolverAVerGuia={
              guiaBasicaAbierta
                ? undefined
                : () => {
                    guia.reiniciar();
                    setSection('inicio');
                  }
            }
          />
        ) : null}
        </motion.div>
        </AnimatePresence>

        <AnimatePresence>
        {panelDinero !== null ? (
          <HojaPanel
            titulo={
              panelDineroCajitaId !== null
                ? cajitas.find((c) => c.id === panelDineroCajitaId)?.nombre ?? ''
                : panelDinero === 'deuda'
                  ? 'Tarjetas y deudas'
                  : panelDinero === 'cajita'
                    ? 'Ahorros'
                    : 'Cuentas'
            }
            onCerrar={() => {
              setPanelDinero(null);
              setPanelDineroCajitaId(null);
            }}
          >
            {/* Si hay un ID específico, mostrar detalle de una sola cajita */}
            {panelDineroCajitaId !== null ? (
              (() => {
                const cajitaSeleccionada = cajitas.find((c) => c.id === panelDineroCajitaId);
                return cajitaSeleccionada ? (
                  <DetalleCajita
                    cajita={cajitaSeleccionada}
                    movimientos={cajitaMovimientos}
                    transacciones={transacciones}
                    onFijarSaldo={(cajitaId: string, saldo: number) => void almacen.fijarSaldo(cajitaId, saldo)}
                    onEliminar={(id: string) => void almacen.borrarCajita(id)}
                    onTransferir={(origenId, destinoId, montoCop) =>
                      almacen.transferirEntreCuentas({ origenId, destinoId, montoCop })
                    }
                    destinos={destinosDeTransferencia}
                  />
                ) : null;
              })()
            ) : /* Si no hay ID, mostrar lista de todas las cajitas del tipo */
            panelDinero === 'deuda' ? (
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
            ) : (
              <CajitasView
                tipo={panelDinero}
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
            )}
          </HojaPanel>
        ) : null}
        </AnimatePresence>

        {/* ------------------------------------------- los paneles de Ajustes ---
 Cada uno se abre a pantalla completa encima de la lista. Antes eran
 pestañas escondidas tras `hidden lg:grid`, y por eso cuatro de ellos
 no existían en el celular. */}
        <AnimatePresence>
        {panelAjustes !== null ? (
          <HojaPanel
            titulo={PANELES_AJUSTES.find((p) => p.id === panelAjustes)?.label ?? ''}
            onCerrar={() => setPanelAjustes(null)}
          >
            {panelAjustes === 'cuentas' ? (
              <ConfiguracionView
                cajitas={cajitas}
                transacciones={transacciones}
                movimientos={cajitaMovimientos}
                onActualizar={(cajita) => void almacen.actualizarCajita(cajita)}
                onFijarSaldo={(cajitaId, saldo) => void almacen.fijarSaldo(cajitaId, saldo)}
              />
            ) : panelAjustes === 'categorias' ? (
              <CategoriasEditor
                categorias={categorias}
                transacciones={transacciones}
                onCrear={(datos) => void almacen.crearCategoria(datos)}
                onActualizar={(c) => void almacen.actualizarCategoria(c)}
                onArchivar={(id) => void almacen.archivarCategoria(id)}
                onBorrar={(id) => void almacen.borrarCategoria(id)}
              />
            ) : panelAjustes === 'topes' ? (
              <PresupuestosView
                presupuestos={almacen.datos.presupuestos}
                transacciones={transacciones}
                mes={month}
                hoy={today}
                onFijar={(categoria, montoCop) =>
                  void almacen.fijarPresupuesto(categoria, montoCop)
                }
                onQuitar={(categoria) => void almacen.quitarPresupuesto(categoria)}
                onNuevaTransaccion={(categoria) =>
                  setPending({ ...movimientoEnBlanco(), category: categoria })
                }
              />
            ) : panelAjustes === 'metas' ? (
              <MetasView
                metas={almacen.datos.metas}
                cajitas={cajitas}
                movimientos={cajitaMovimientos}
                onCrear={(datos) => void almacen.crearMeta(datos)}
                onActualizar={(meta) => void almacen.actualizarMeta(meta)}
                onEliminar={(id) => void almacen.borrarMeta(id)}
              />
            ) : panelAjustes === 'recurrentes' ? (
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
            ) : panelAjustes === 'extractos' ? (
              <AnalistaView
                existentes={transacciones}
                onImportar={(nuevos) => void almacen.importarTransacciones(nuevos)}
              />
            ) : panelAjustes === 'atajos' ? (
              <PanelAtajos />
            ) : panelAjustes === 'gmf' ? (
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
            ) : panelAjustes === 'nombres' ? (
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
            ) : panelAjustes === 'contraseña' ? (
              <PasswordRecoveryView email={cuenta?.email} />
            ) : (
              <PanelRespaldo
                datos={almacen.datos}
                hoy={today}
                onRestaurar={(d) => void almacen.restaurar(d)}
                onGenerarInforme={() => {
                  setPanelAjustes(null);
                  setMostrarReporte(true);
                }}
              />
            )}
          </HojaPanel>
        ) : null}
        </AnimatePresence>

        {/* ------------------------------------------------------- el buscador --- */}
        <AnimatePresence>
        {capa === 'buscar' ? (
          <HojaPanel
            titulo="Buscar"
            onCerrar={() => {
              setCapa(null);
              setFiltro(FILTRO_VACIO);
            }}
          >
            <div className="flex flex-col gap-5">
              <BuscadorMovimientos
                filtro={filtro}
                onCambiar={setFiltro}
                resultados={visibles}
                cuentas={cuentasParaElegir}
              />
              <TransactionList transactions={visibles} conSenal={conSenal} onAbrir={setDetalle} />
            </div>
          </HojaPanel>
        ) : null}
        </AnimatePresence>

        {/* ------------------------------------------------------------ capas --- */}

        {/* La pantalla de anotar. Sigue siendo obligatorio ver el número antes de
 que se guarde — eso no cambió. Lo que cambió es que dejó de parecer un
 formulario. */}
        {pending ? (
          <Captura
            parsed={pending}
            cuentaPorDefecto={cuentaPorDefecto}
            onSave={handleSave}
            onCancel={cerrarCaptura}
          />
        ) : null}

        {detalle ? (
          <DetalleMovimiento
            tx={detalle}
            nombreCuenta={nombreDeCuenta(detalle.cuentaId)}
            onCerrar={() => setDetalle(null)}
            onEditar={(tx) => {
              setDetalle(null);
              setEditando(tx);
            }}
            onAnalizar={(tx) => {
              setDetalle(null);
              setAnalizando(tx);
            }}
            onBorrar={(id) => {
              setDetalle(null);
              void almacen.borrarTransaccion(id);
            }}
          />
        ) : null}

        {analizando ? (
          <AnalisisMovimiento
            tx={analizando}
            historial={transacciones}
            onCerrar={() => setAnalizando(null)}
          />
        ) : null}

        {/* Editar sigue usando el formulario completo de siempre, con sus seis
 campos. Es lo correcto: al corregir algo uno SÍ quiere ver todo y
 poder tocarlo. Lo que se adelgazó fue el camino de crear, no el de
 arreglar. */}
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

        <AvisoGuardado
          guardado={guardado}
          onDeshacer={(id) => {
            void almacen.borrarTransaccion(id);
            setGuardado(null);
          }}
          onCerrar={() => setGuardado(null)}
        />

        {/* La bienvenida, una pregunta a la vez. Se decide con una bandera que se
 guarda de verdad, no con `transacciones.length === 0`: así no vuelve a
 aparecer el día que alguien borre su único movimiento. */}
        {!onboarding.terminado ? (
          <Onboarding
            onTerminar={({ nombre, banco, saldoCop }) => {
              if (nombre) onboarding.guardarNombre(nombre);
              if (banco) {
                void almacen.crearCajita({
                  nombre: banco,
                  icon: 'wallet',
                  tipo: 'cuenta',
                  metaCop: null,
                  tasaEaPct: null,
                  saldoInicialCop: saldoCop ?? 0,
                });
              }
              onboarding.terminar();
            }}
            onAnotarHablando={() => setPending(movimientoEnBlanco())}
          />
        ) : null}

        {/* LA GUÍA
            Dos recorridos que nunca coinciden: el básico enseña el mapa una
            sola vez, y el de cada sitio sale al llegar por primera vez. La
            condición de `guiaSeccionAbierta` ya exige que el básico haya
            pasado, así que no hace falta ordenarlos aquí. */}
        {guiaBasicaAbierta ? (
          <GuiaApp pasos={PASOS_BASICOS} onCerrar={guia.terminarBasica} />
        ) : null}

        {guiaSeccionAbierta && pasoDeSeccion ? (
          <GuiaApp
            key={section}
            pasos={[pasoDeSeccion]}
            onCerrar={() => guia.marcarSeccion(section)}
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
      </LukAppShell>
    </CatalogoProvider>
  );
};
