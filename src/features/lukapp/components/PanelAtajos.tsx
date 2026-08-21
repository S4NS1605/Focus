import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, KeyRound, Plus, Smartphone, Trash2 } from 'lucide-react';
import { RippleButton } from './RippleButton';
import { apiUrl } from '../../../lib/api';
import { RippleButton } from './RippleButton';
import { obtenerSupabase } from '../data/supabase';
import { RippleButton } from './RippleButton';

/** El Atajo ya armado en iCloud: trae el disparador y la petición prellenados,
    solo falta que cada quien pegue su llave en el encabezado Authorization.
    Sin este link, montar el Atajo a mano son ~10 pasos que casi nadie termina. */
const URL_ATAJO_ICLOUD = 'https://www.icloud.com/shortcuts/5331c6951e0e411c96a6bf39adaeb95c';

interface LlaveAtajo {
  id: string;
  pista: string;
  etiqueta: string;
  creada_en: string;
  usada_en: string | null;
  revocada_en: string | null;
}

/** Fecha corta, sin hora: es de un vistazo, no un registro exacto. */
const fechaCorta = (iso: string): string =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/** El botón de copiar de esta pantalla: mismo icono, mismo aviso de "listo". */
const BotonCopiar: React.FC<{ valor: string; etiqueta: string }> = ({ valor, etiqueta }) => {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles no hay mucho más que ofrecer: el valor
      // sigue seleccionable a mano en el campo de al lado.
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      className="flex shrink-0 items-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)]"
      aria-label={`Copiar ${etiqueta}`}
    >
      {copiado ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      )}
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  );
};

/**
 * Registro automático: que un pago con Apple Pay se anote solo.
 *
 * La pieza que falta para que un Atajo de iOS funcione es una credencial que
 * no dependa de que haya alguien mirando la pantalla para iniciar sesión. Esta
 * pantalla es donde esa credencial se crea, se enseña UNA vez —el servidor
 * solo guarda su hash, así que perder la llave aquí es perderla— y se revoca si
 * el teléfono se pierde.
 *
 * La creación y el listado hablan con `/api/atajos/llave` con la sesión de
 * Supabase de siempre. El propio Atajo, en cambio, nunca ve esa sesión: llama
 * a `/api/atajo/movimiento` con la llave como su única credencial.
 */
export const PanelAtajos: React.FC = () => {
  const [llaves, setLlaves] = useState<LlaveAtajo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState<{ llave: string; pista: string } | null>(null);

  const conToken = useCallback(async <T,>(hacer: (token: string) => Promise<T>): Promise<T> => {
    const cliente = obtenerSupabase();
    const session = cliente ? (await cliente.auth.getSession()).data.session : null;
    if (!session?.access_token) throw new Error('Sesión no disponible');
    return hacer(session.access_token);
  }, []);

  const cargar = useCallback(() => {
    setError(null);
    conToken(async (token) => {
      const res = await fetch(apiUrl('/api/atajos/llave'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudieron cargar las llaves');
      const data = await res.json();
      setLlaves(data.llaves ?? []);
    }).catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las llaves'));
  }, [conToken]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crear = async () => {
    setCreando(true);
    setError(null);
    try {
      await conToken(async (token) => {
        const res = await fetch(apiUrl('/api/atajos/llave'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ etiqueta: 'Mi iPhone' }),
        });
        if (!res.ok) throw new Error('No se pudo crear la llave');
        const data = await res.json();
        setNueva({ llave: data.llave, pista: data.pista });
      });
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la llave');
    } finally {
      setCreando(false);
    }
  };

  const revocar = async (id: string) => {
    setError(null);
    try {
      await conToken(async (token) => {
        const res = await fetch(apiUrl('/api/atajos/revocar'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error('No se pudo revocar la llave');
      });
      cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo revocar la llave');
    }
  };

  const vivas = (llaves ?? []).filter((l) => !l.revocada_en);
  const urlEndpoint = apiUrl('/api/atajo/movimiento');

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-1.5 px-1 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
          <Smartphone className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          Registro automático
        </h2>
        <p className="mt-1 px-1 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
          Un Atajo de iOS puede anotar cada pago con Apple Pay sin que abras la app. Crea una llave
          aquí y pégala en el Atajo.
        </p>
      </div>

      {error ? (
        <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--fin-out-ink)]">
          {error}
        </p>
      ) : null}

      {nueva ? (
        <div className="flex flex-col gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-4">
          <p className="text-[13px] font-semibold text-[var(--fin-ink)]">
            Tu llave nueva — cópiala ahora, no se vuelve a enseñar
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[13px] text-[var(--fin-ink)]">
              {nueva.llave}
            </code>
            <BotonCopiar valor={nueva.llave} etiqueta="la llave" />
          </div>
          <button
            type="button"
            onClick={() => setNueva(null)}
            className="self-start text-[13px] font-semibold text-[var(--fin-ink-soft)] underline underline-offset-2"
          >
            Ya la guardé
          </button>
        </div>
      ) : null}

      <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        {llaves === null ? (
          <p className="text-[13px] text-[var(--fin-ink-faint)]">Cargando…</p>
        ) : vivas.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
            Todavía no tienes ninguna llave.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {vivas.map((l) => (
              <li key={l.id} className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]"
                  aria-hidden="true"
                >
                  <KeyRound className="h-[18px] w-[18px] text-[var(--fin-ink-soft)]" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-[var(--fin-ink)]">
                    {l.etiqueta} · ···{l.pista}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-[var(--fin-ink-faint)]">
                    Creada el {fechaCorta(l.creada_en)}
                    {l.usada_en ? ` · usada por última vez el ${fechaCorta(l.usada_en)}` : ' · nunca usada'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void revocar(l.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-[var(--fin-r-control)] px-3 py-2 text-[13px] font-semibold text-red-500 transition-colors hover:bg-[var(--fin-out-bg)]"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                  Revocar
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => void crear()}
          disabled={creando}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[17px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-60"
        >
          <Plus className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
          {creando ? 'Creando…' : 'Crear llave nueva'}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <p className="text-[13px] font-semibold text-[var(--fin-ink)]">Instala el Atajo</p>
        <p className="text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
          Ya viene armado — el disparador y la petición al servidor ya están puestos. Solo te falta
          pegar tu llave.
        </p>
        <a
          href={URL_ATAJO_ICLOUD}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[17px] font-semibold text-[var(--fin-on-accent)]"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          Añadir atajo
        </a>
        <ol className="flex flex-col gap-2 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
          <li>1. Toca &quot;Añadir atajo&quot; arriba — se abre la app Atajos con todo ya listo.</li>
          <li>
            2. Toca <strong>&quot;Agregar atajo&quot;</strong> para instalarlo, luego ábrelo para
            editarlo.
          </li>
          <li>
            3. Busca la acción <strong>&quot;Obtener contenido de URL&quot;</strong> → Encabezados →
            reemplaza <code>PEGA_TU_LLAVE_AQUI</code> por tu llave de arriba, tal cual (no hace falta
            escribir &quot;Bearer&quot;).
          </li>
          <li>4. Guarda. Cada pago con tarjeta va a anotarse solo, ya categorizado y con la fecha correcta.</li>
        </ol>

        <details className="mt-1 text-[13px] text-[var(--fin-ink-faint)]">
          <summary className="cursor-pointer font-semibold text-[var(--fin-ink-soft)]">
            Prefiero armarlo yo mismo
          </summary>
          <ol className="mt-2 flex flex-col gap-2 leading-relaxed">
            <li>
              1. En Atajos → Automatización, crea una automatización personal con el evento{' '}
              <strong>&quot;Cuando se use Cualquier tarjeta&quot;</strong>.
            </li>
            <li>
              2. Añade <strong>&quot;Obtener contenido de URL&quot;</strong>, método{' '}
              <strong>POST</strong>, con esta dirección:
            </li>
          </ol>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[13px] text-[var(--fin-ink)]">
              {urlEndpoint}
            </code>
            <BotonCopiar valor={urlEndpoint} etiqueta="la dirección" />
          </div>
          <ol start={3} className="mt-2 flex flex-col gap-2 leading-relaxed">
            <li>
              3. En Encabezados, añade <code>Authorization</code> con tu llave.
            </li>
            <li>
              4. En Cuerpo de la petición (JSON), agrega <code>monto</code> con la variable{' '}
              <strong>Cantidad</strong> de la transacción, y <code>comercio</code> con{' '}
              <strong>Comercio</strong>.
            </li>
          </ol>
        </details>
      </div>
    </section>
  );
};
