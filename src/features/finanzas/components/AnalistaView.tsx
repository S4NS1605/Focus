import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileDown, FileText, FileUp, KeyRound, Loader2, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type { Transaction } from '../types';
import { planearImportacion } from '../analista/aMovimientos';
import type { Trabajo } from '../analista/useAnalista';
import { useAnalista } from '../analista/useAnalista';
import { AnalistaReporte } from './AnalistaReporte';

interface AnalistaViewProps {
  existentes: readonly Transaction[];
  onImportar: (nuevos: Transaction[]) => void;
}

const nuevoId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tx-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const segundosDe = (trabajo: Trabajo, ahora: number): number =>
  Math.max(0, Math.floor((ahora - trabajo.inicio) / 1000));

// -----------------------------------------------------------------------------

interface TrabajoEnCursoProps {
  trabajo: Trabajo;
  segundos: number;
}

const TrabajoEnCurso: React.FC<TrabajoEnCursoProps> = ({ trabajo, segundos }) => (
  <li className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
    <div className="flex items-center gap-3">
      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--fin-ink-faint)]" strokeWidth={3} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold">{trabajo.archivo.name}</p>
        <p className="text-[12px] text-[var(--fin-ink-soft)]">
          {segundos > 0 ? `Leyendo tu extracto… van ${segundos}s` : 'Leyendo tu extracto…'}
        </p>
      </div>
    </div>
  </li>
);

interface TrabajoConErrorProps {
  trabajo: Trabajo;
  onReintentar: (id: string) => void;
  onQuitar: (id: string) => void;
}

const TrabajoConError: React.FC<TrabajoConErrorProps> = ({ trabajo, onReintentar, onQuitar }) => (
  <li className="rounded-3xl bg-[var(--fin-out-bg)] p-5">
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-out)]" strokeWidth={3} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-extrabold text-[var(--fin-out)]">{trabajo.archivo.name}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--fin-out)]">{trabajo.error?.mensaje}</p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => onReintentar(trabajo.id)}
            className="rounded-full bg-[var(--fin-card)] px-3.5 py-1.5 text-[11px] font-bold text-[var(--fin-out)]"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => onQuitar(trabajo.id)}
            className="rounded-full px-3.5 py-1.5 text-[11px] font-bold text-[var(--fin-ink-soft)]"
          >
            Quitar
          </button>
        </div>
      </div>
    </div>
  </li>
);

interface TrabajoListoProps {
  trabajo: Trabajo;
  existentes: readonly Transaction[];
  onImportar: (nuevos: Transaction[]) => void;
  onQuitar: (id: string) => void;
  contraido: boolean;
  onToggle: (id: string) => void;
}

const TrabajoListo: React.FC<TrabajoListoProps> = ({
  trabajo,
  existentes,
  onImportar,
  onQuitar,
  contraido,
  onToggle,
}) => {
  const [importado, setImportado] = useState(0);
  if (!trabajo.resultado) return null;

  // Recomputed on every render from the CURRENT ledger, not memoized against a
  // stale snapshot — importing job A must immediately stop job B from also
  // offering the same overlapping rows as "new".
  const plan = planearImportacion(trabajo.resultado.movimientos, existentes, nuevoId);

  return (
    <li className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
      <button
        type="button"
        onClick={() => onToggle(trabajo.id)}
        className="flex w-full items-center gap-3 text-left"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--fin-in)]" strokeWidth={2.5} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{trabajo.archivo.name}</p>
          <p className="truncate text-[11px] font-semibold text-[var(--fin-ink-faint)] capitalize">
            {trabajo.resultado.periodo.etiqueta}
            {importado > 0 ? ` · ${importado} importado${importado === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--fin-ink-faint)] transition-transform ${contraido ? '' : 'rotate-180'}`}
          strokeWidth={3}
        />
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onQuitar(trabajo.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onQuitar(trabajo.id);
            }
          }}
          aria-label={`Quitar ${trabajo.archivo.name} de la lista`}
          className="shrink-0 rounded-full p-1.5 text-[var(--fin-ink-ghost)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
        >
          <X className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      </button>

      {!contraido ? (
        <div className="mt-4 flex flex-col gap-5 border-t border-[var(--fin-line)] pt-4">
          <section className="rounded-2xl bg-[var(--fin-soft)] p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
              <Download className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              Importar a tu historial
            </h3>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Nuevos', n: plan.nuevos.length, ink: 'var(--fin-in)' },
                { label: 'Ya estaban', n: plan.duplicados.length, ink: 'var(--fin-ink-soft)' },
                { label: 'No cuentan', n: plan.excluidos.length, ink: 'var(--fin-baja-ink)' },
              ].map((c) => (
                <div key={c.label} className="rounded-xl bg-[var(--fin-card)] px-2 py-2.5">
                  <p className="text-lg font-extrabold tabular-nums" style={{ color: c.ink }}>
                    {c.n}
                  </p>
                  <p className="text-[10px] font-bold text-[var(--fin-ink-soft)]">{c.label}</p>
                </div>
              ))}
            </div>

            {importado > 0 ? (
              <p className="mt-3 rounded-xl bg-[var(--fin-in-bg)] px-3 py-2.5 text-[12px] font-bold text-[var(--fin-in)]">
                Importaste {importado} movimiento{importado === 1 ? '' : 's'}.
              </p>
            ) : (
              <button
                type="button"
                disabled={plan.nuevos.length === 0}
                onClick={() => {
                  onImportar(plan.nuevos);
                  setImportado(plan.nuevos.length);
                }}
                className="mt-3 w-full rounded-full bg-[var(--fin-accent)] px-6 py-3 text-[13px] font-bold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)] disabled:opacity-30"
              >
                {plan.nuevos.length === 0
                  ? 'Nada nuevo por importar'
                  : `Importar ${plan.nuevos.length} movimiento${plan.nuevos.length === 1 ? '' : 's'}`}
              </button>
            )}

            {plan.duplicados.length > 0 && plan.nuevos.length > 0 ? (
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
                {plan.duplicados.length} ya estaban en tu historial y no se van a duplicar.
              </p>
            ) : null}
          </section>

          <AnalistaReporte resultado={trabajo.resultado} />
        </div>
      ) : null}
    </li>
  );
};

// -----------------------------------------------------------------------------

export const AnalistaView: React.FC<AnalistaViewProps> = ({ existentes, onImportar }) => {
  const analista = useAnalista();
  const [tokenBorrador, setTokenBorrador] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const [contraidos, setContraidos] = useState<Set<string>>(new Set());
  const inputArchivo = useRef<HTMLInputElement>(null);
  const contadorArrastre = useRef(0);

  const toggleContraido = (id: string) => {
    setContraidos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  // ---------- Token gate ----------
  if (!analista.token) {
    return (
      <div className="mx-auto max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            analista.guardarToken(tokenBorrador);
          }}
          className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 text-center"
        >
          <KeyRound className="mx-auto h-9 w-9 text-[var(--fin-ink-faint)]" strokeWidth={1.75} aria-hidden="true" />
          <h2 className="mt-3 text-lg font-extrabold tracking-tight">Token de acceso</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
            El endpoint pide un token para que nadie más que encuentre la URL pueda usarlo.
            Guárdalo cuando tu navegador lo ofrezca y en tus otros dispositivos con la misma
            cuenta (iCloud Keychain o Google) aparecerá solo.
          </p>

          {/* A visible username field is what makes Safari/Chrome recognize this
              as a real login form and offer to save it to iCloud Keychain /
              Google Password Manager — which is what actually syncs the token
              across the owner's own devices without ever putting the secret in
              the public bundle. A hidden or absent username field makes most
              password managers skip the save prompt entirely. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            defaultValue="finanzas"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            className="sr-only"
          />

          <input
            type="password"
            name="password"
            value={tokenBorrador}
            onChange={(e) => setTokenBorrador(e.target.value)}
            autoComplete="current-password"
            placeholder="ANALISTA_TOKEN"
            className="mt-5 w-full rounded-2xl border-2 border-[var(--fin-line)] bg-[var(--fin-bg)] px-4 py-3 text-center text-base font-medium focus:border-[var(--fin-ink-faint)] focus:outline-none"
            aria-label="Token de acceso"
          />

          <button
            type="submit"
            disabled={!tokenBorrador.trim()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--fin-accent)] px-6 py-3.5 text-sm font-bold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)] disabled:opacity-30"
          >
            <KeyRound className="h-4 w-4" strokeWidth={3} />
            Guardar
          </button>
        </form>
      </div>
    );
  }

  const enCurso = analista.trabajos.filter((t) => t.fase === 'subiendo');
  const conError = analista.trabajos.filter((t) => t.fase === 'error');
  const listos = analista.trabajos.filter((t) => t.fase === 'listo');

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {/* ---------- Dropzone: always visible, so more files can be added anytime ---------- */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          // A counter rather than a boolean: dragging over a CHILD element fires
          // dragleave on the parent, which would flicker the highlight off
          // mid-drag if tracked with a plain flag.
          contadorArrastre.current += 1;
          setArrastrando(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          contadorArrastre.current = Math.max(0, contadorArrastre.current - 1);
          if (contadorArrastre.current === 0) setArrastrando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          contadorArrastre.current = 0;
          setArrastrando(false);
          const archivos = [...e.dataTransfer.files];
          if (archivos.length > 0) analista.analizarArchivos(archivos);
        }}
        className={`rounded-3xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
          arrastrando ? 'border-[var(--fin-ink)] bg-[var(--fin-soft)]' : 'border-[var(--fin-line)] bg-[var(--fin-card)]'
        }`}
      >
        {arrastrando ? (
          <FileDown className="mx-auto h-9 w-9 text-[var(--fin-ink)]" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <FileText className="mx-auto h-9 w-9 text-[var(--fin-ink-faint)]" strokeWidth={1.75} aria-hidden="true" />
        )}
        <h2 className="mt-3 text-lg font-extrabold tracking-tight">
          {arrastrando ? 'Suelta aquí' : 'Sube tus extractos'}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
          Arrastra uno o varios PDF, o elígelos desde el explorador. Hasta 4 MB cada uno.
        </p>

        <input
          ref={inputArchivo}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const archivos = e.target.files ? [...e.target.files] : [];
            if (archivos.length > 0) analista.analizarArchivos(archivos);
            // Reset so picking the same file(s) twice still fires onChange.
            e.target.value = '';
          }}
        />

        <motion.button
          type="button"
          onClick={() => inputArchivo.current?.click()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--fin-accent)] px-7 py-3.5 text-sm font-bold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)]"
        >
          <FileUp className="h-4 w-4" strokeWidth={3} />
          Elegir PDF
        </motion.button>

        <p className="mx-auto mt-4 flex max-w-sm items-start gap-1.5 text-left text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          <span>
            El análisis se hace con plantillas propias, sin inteligencia artificial: tu extracto
            nunca sale de este servidor. Soporta Nequi, Nu y Bancolombia.
          </span>
        </p>
      </section>

      {/* ---------- Jobs in flight ---------- */}
      {enCurso.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {enCurso.map((trabajo) => (
            <TrabajoEnCurso key={trabajo.id} trabajo={trabajo} segundos={segundosDe(trabajo, analista.ahora)} />
          ))}
        </ul>
      ) : null}

      {/* ---------- Failed jobs ---------- */}
      {conError.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {conError.map((trabajo) => (
            <TrabajoConError
              key={trabajo.id}
              trabajo={trabajo}
              onReintentar={analista.reintentar}
              onQuitar={analista.quitarTrabajo}
            />
          ))}
        </ul>
      ) : null}

      {/* ---------- Finished jobs, newest first (already the array order) ---------- */}
      {listos.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {listos.map((trabajo) => (
            <TrabajoListo
              key={trabajo.id}
              trabajo={trabajo}
              existentes={existentes}
              onImportar={onImportar}
              onQuitar={analista.quitarTrabajo}
              contraido={contraidos.has(trabajo.id)}
              onToggle={toggleContraido}
            />
          ))}
        </ul>
      ) : null}

      {analista.trabajos.length > 0 ? (
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--fin-ink-faint)]">
          <RotateCcw className="h-3 w-3" strokeWidth={3} />
          Puedes seguir arrastrando más extractos mientras estos terminan.
        </p>
      ) : null}
    </div>
  );
};
