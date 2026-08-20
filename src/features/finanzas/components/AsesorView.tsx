import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, BrainCircuit, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { Transaction } from '../types';
import type { Cajita } from '../data/modelos';
import { responderAsesor, detectarMovimiento, type AsesorContext } from '../lib/asesorBot';
import type { ParsedTransaction } from '../lib/parseTransaction';

import type { LexicoAprendido } from '../lib/aprendizaje';
import type { CategoriaPersonal } from '../categorias';

import { apiUrl } from '../../../lib/api';
import { obtenerSupabase } from '../data/supabase';
import { bogotaDate, asesorEnHorario, ASESOR_DESDE } from '../lib/localDate';
import { ES_PASIVO } from '../data/modelos';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  provider?: string;
  action?: ParsedTransaction;
  actions?: ParsedTransaction[];
  suggestions?: string[];
}

/**
 * Si hay un modelo detrás del asesor o si contesta el motor local.
 *
 * `despertando` es un estado real, no un adorno: en el plan gratuito de Render el
 * servicio se duerme y la primera petición tarda hasta ~40 s. Sin este estado esa
 * espera parecía que la app se hubiera colgado.
 */
type EstadoConexion = 'despertando' | 'en-linea' | 'local';

/**
 * Cómo se le cuenta el estado a quien está mirando.
 *
 * Fuera del horario de servicio no se dice "sin conexión", porque no está roto:
 * el ping que lo mantiene despierto solo corre de día, así que de noche duerme a
 * propósito. Llamarlo "descansando" y decir a qué hora vuelve es la verdad, y
 * además explica por qué el primer mensaje va a tardar.
 */
export const etiquetaConexion = (estado: EstadoConexion, ahora: Date = new Date()): string => {
  if (estado === 'en-linea') return 'En línea';
  const enHorario = asesorEnHorario(ahora);
  if (estado === 'despertando') {
    return enHorario ? 'Conectando…' : 'Despertando… puede tardar un momento';
  }
  return enHorario
    ? 'Sin conexión · responde el modo local'
    : `Descansando hasta las ${ASESOR_DESDE} a. m. · responde el modo local`;
};

interface AsesorViewProps {
  transacciones: readonly Transaction[];
  cajitas: readonly Cajita[];
  cajitasBalances: Record<string, number>;
  categorias: readonly CategoriaPersonal[];
  lexico: LexicoAprendido;
  onCrearTransaccion?: (tx: ParsedTransaction) => void;
}

const nuevoId = () => `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/** Chips para arrancar una conversación vacía — el punto de entrada más usado. */
const SUGERENCIAS_INICIALES = [
  'Dime mi resumen',
  '¿Cuánto puedo gastar?',
  'Mis suscripciones',
  'Sorpréndeme',
];

const renderMarkdownLine = (line: string) => {
  const parts = line.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

export const AsesorView: React.FC<AsesorViewProps> = ({
  transacciones,
  cajitas,
  cajitasBalances,
  categorias,
  lexico,
  onCrearTransaccion,
}) => {
  const [context, setContext] = useState<AsesorContext>({ ultimoAsunto: null, ultimaFecha: null });
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'bot',
      text: '¡Hola! Soy tu asesor financiero personal. Puedo ayudarte a consultar tus gastos, revisar tu balance, o darte consejos sobre cómo vas este mes. ¿En qué te ayudo hoy?',
    },
  ]);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  const [feedback, setFeedback] = useState<Map<string, 'like' | 'dislike'>>(new Map());
  const { guardar: guardarFeedback } = useFeedbackAsesor();
  const [conexion, setConexion] = useState<EstadoConexion>('despertando');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pensando]);

  // Se pregunta por el estado al abrir el chat. La petición despierta de paso el
  // servicio, así que para cuando escribas el primer mensaje suele estar listo.
  useEffect(() => {
    let vigente = true;
    fetch(apiUrl('/api/salud'))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vigente) setConexion(d?.ia ? 'en-linea' : 'local');
      })
      .catch(() => {
        // Sin servidor no hay IA, pero el motor local sigue respondiendo.
        if (vigente) setConexion('local');
      });
    return () => {
      vigente = false;
    };
  }, []);

  // `textoDirecto` deja que un chip de sugerencia envíe su propio texto sin
  // pasar por el campo de escritura: `setInput` es asíncrono, así que
  // `setInput(sug)` seguido de `handleSend()` vería el valor VIEJO de
  // `input` por el cierre de la función — antes esto se resolvía con
  // `setTimeout` adivinando cuánto tardaba React en re-renderizar, que es
  // frágil (¿400ms? ¿y si el dispositivo es más lento?). Pasar el texto
  // directo no depende de ningún tiempo de espera.
  const handleSend = async (textoDirecto?: string) => {
    const textoUsuario = (textoDirecto ?? input).trim();
    if (!textoUsuario || pensando) return;

    const userMsg: Message = { id: nuevoId(), role: 'user', text: textoUsuario };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setPensando(true);

    try {
      // 1. Intentar llamar al Asesor con Inteligencia Artificial (LLM)
      const cliente = obtenerSupabase();
      const session = cliente ? (await cliente.auth.getSession()).data.session : null;

      const mesActual = bogotaDate().slice(0, 7);
      const txMes = transacciones.filter((t) => t.occurredOn.startsWith(mesActual));
      const gastosMes = txMes
        .filter((t) => t.kind === 'gasto')
        .reduce((acc, t) => acc + t.amountCop, 0);
      const ingresosMes = txMes
        .filter((t) => t.kind === 'ingreso')
        .reduce((acc, t) => acc + t.amountCop, 0);

      const finanzasContext = {
        mes: mesActual,
        gastosEsteMesCop: gastosMes,
        ingresosEsteMesCop: ingresosMes,
        balanceMesCop: ingresosMes - gastosMes,
        cuentas: cajitas
          .filter((c) => !c.archivedAt && !ES_PASIVO[c.tipo])
          .map((c) => ({
            nombre: c.nombre,
            saldoCop: cajitasBalances[c.id] ?? 0,
          })),
        deudas: cajitas
          .filter((c) => !c.archivedAt && ES_PASIVO[c.tipo])
          .map((c) => ({
            nombre: c.nombre,
            deudaCop: cajitasBalances[c.id] ?? 0,
          })),
        topCategoriasGasto: Array.from(
          txMes
            .filter((t) => t.kind === 'gasto')
            .reduce((map, t) => {
              map.set(t.category, (map.get(t.category) || 0) + t.amountCop);
              return map;
            }, new Map<string, number>())
            .entries(),
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([cat, total]) => ({ categoria: cat, totalCop: total })),
      };

      let respondidoPorLLM = false;

      if (session?.access_token) {
        try {
          const res = await fetch(apiUrl('/api/asesor-ia'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              prompt: textoUsuario,
              history: messages.slice(-5),
              finanzasContext,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (!data.offline && data.text) {
              // El modelo redacta la respuesta, pero nunca decide qué se
              // guarda: se le pasa lo que la persona dictó por la MISMA
              // puerta que usa el motor local (detectarMovimiento), que corre
              // parseTransaction de forma determinista. Si el modelo se
              // inventa un monto que no dijiste, no hay botón de confirmar —
              // solo aparece cuando el parser, no el LLM, confirma que hay un
              // movimiento real ahí.
              const deteccion = detectarMovimiento(
                textoUsuario,
                transacciones,
                cajitas,
                categorias,
                lexico,
                context,
              );
              setContext(deteccion.newContext);

              const botMsg: Message = {
                id: nuevoId(),
                role: 'bot',
                text: data.text,
                provider: data.provider,
                action: deteccion.propuesta?.action,
                actions: deteccion.propuesta?.actions,
              };
              setMessages((prev) => [...prev, botMsg]);
              respondidoPorLLM = true;
              setConexion('en-linea');
            }
          }
        } catch {
          // Si falla la red, el fallback offline toma el control
        }
      }

      // 2. Si no hay LLM configurado o falló, usar el motor offline local.
      // El indicador baja a 'local' para que el encabezado diga la verdad: si
      // estas respuestas las da el motor de reglas, no puede seguir anunciando
      // que hay una IA en línea.
      if (!respondidoPorLLM) {
        setConexion('local');
        const {
          text: respuesta,
          newContext,
          action,
          actions,
          suggestions,
        } = responderAsesor(
          textoUsuario,
          transacciones,
          cajitas,
          cajitasBalances,
          categorias,
          lexico,
          context,
        );
        setContext(newContext);
        const botMsg: Message = {
          id: nuevoId(),
          role: 'bot',
          text: respuesta,
          action,
          actions,
          suggestions,
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    } finally {
      setPensando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // El estado se dice tal cual es: en línea con IA, despertando, o respondiendo
  // en local. Fingir "en línea" mientras contesta el motor de reglas sería
  // mentirle a quien pregunta.
  const colorConexion =
    conexion === 'en-linea'
      ? 'var(--fin-in)'
      : conexion === 'despertando'
        ? 'var(--fin-warn)'
        : 'var(--fin-ink-faint)';

  return (
    <div className="flex min-h-[60vh] flex-col">
      {/* Sin cabecera propia: esta vista se abre dentro de una hoja que ya pone
          el título "Preguntar" arriba. Antes ponía otra encima que decía "Tu
          Asesor Financiero", así que se veían dos títulos seguidos diciendo casi
          lo mismo. Aquí solo queda la línea de estado, que sí aporta algo que el
          título no puede decir. */}
      <p className="flex items-center gap-2 pb-4 text-[13px] text-[var(--fin-ink-soft)]">
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-2 shrink-0 rounded-[var(--fin-r-pill)] ${
            conexion === 'local' ? '' : 'animate-pulse'
          }`}
          style={{ backgroundColor: colorConexion }}
        />
        <span className="truncate">{etiquetaConexion(conexion)}</span>
      </p>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Antes de que exista una conversación real (solo el saludo inicial),
 un único globo de chat flotando en una pantalla ancha se ve como un
 vacío negro con una frase perdida en la esquina — es justo lo que
 se veía "muy feo". En vez de eso, un punto de partida real: el
 saludo centrado como intro, no como burbuja, y chips que arrancan
 la conversación con un clic en lugar de tener que pensar qué
 escribir primero. */}
        {messages.length === 1 ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-10 text-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
              <BrainCircuit className="h-8 w-8" strokeWidth={1.75} />
            </div>
            <p className="text-[17px] leading-relaxed text-[var(--fin-ink-soft)]">
              {messages[0].text}
            </p>
            {/* Las preguntas de arranque. Son la parte importante de esta
                pantalla: nadie sabe qué preguntarle a un asesor la primera vez,
                y tener cuatro para tocar quita ese bloqueo. */}
            <div className="flex flex-wrap justify-center gap-2">
              {SUGERENCIAS_INICIALES.map((sug) => (
                <button
                  key={sug}
                  onClick={() => handleSend(sug)}
                  disabled={pensando}
                  className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)] disabled:opacity-50"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
                  {msg.role === 'user' ? (
                    <User className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <Bot className="h-4 w-4" strokeWidth={2.5} />
                  )}
                </div>
                <div
                  // Quien pregunta va en el color de acento; quien responde, en
                  // el gris de tarjeta. Dos tonos, no dos colores de marca.
                  className={`max-w-[80%] rounded-[var(--fin-r-card)] px-4 py-3 text-[15px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
                      : 'rounded-bl-sm bg-[var(--fin-card)] text-[var(--fin-ink)]'
                  }`}
                >
                  {msg.text.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {renderMarkdownLine(line)}
                      {i !== msg.text.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                  {msg.action && onCrearTransaccion && (
                    <div className="mt-3 border-t border-[var(--fin-line)] pt-3">
                      <button
                        onClick={() => onCrearTransaccion(msg.action!)}
                        className="w-full rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-on-accent)] transition-opacity hover:opacity-90"
                      >
                        Sí, registrar gasto
                      </button>
                    </div>
                  )}
                  {msg.actions && msg.actions.length > 0 && onCrearTransaccion && (
                    <div className="mt-3 border-t border-[var(--fin-line)] pt-3 flex flex-col gap-2">
                      {msg.actions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => onCrearTransaccion(act)}
                          className="w-full rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-on-accent)] transition-opacity hover:opacity-90"
                        >
                          Sí, registrar $ {act.amount?.toLocaleString('es-CO')} en {act.category}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 pt-1">
                      {msg.suggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(sug)}
                          disabled={pensando}
                          className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-1.5 text-[13px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)] disabled:opacity-50"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.role === 'bot' && (
                    <div className="mt-2 flex gap-1.5 border-t border-[var(--fin-line)] pt-2">
                      <button
                        onClick={() => {
                          const nuevoFeedback = new Map(feedback);
                          nuevoFeedback.set(msg.id, 'like');
                          setFeedback(nuevoFeedback);
                          guardarFeedback(msg.id, 'like');
                        }}
                        className={`flex items-center gap-1 rounded-[var(--fin-r-control)] px-2 py-1 text-[12px] transition-colors ${
                          feedback.get(msg.id) === 'like'
                            ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
                            : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]'
                        }`}
                        aria-label="Útil"
                      >
                        <ThumbsUp className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => {
                          const nuevoFeedback = new Map(feedback);
                          nuevoFeedback.set(msg.id, 'dislike');
                          setFeedback(nuevoFeedback);
                          guardarFeedback(msg.id, 'dislike');
                        }}
                        className={`flex items-center gap-1 rounded-[var(--fin-r-control)] px-2 py-1 text-[12px] transition-colors ${
                          feedback.get(msg.id) === 'dislike'
                            ? 'bg-[var(--fin-warn)] text-[var(--fin-on-accent)]'
                            : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]'
                        }`}
                        aria-label="No fue útil"
                      >
                        <ThumbsDown className="h-3 w-3" strokeWidth={2.5} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {pensando && (
              <div className="flex items-end gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
                  <Bot className="h-4 w-4 animate-pulse" strokeWidth={2.5} />
                </div>
                <div className="flex items-center gap-2 rounded-[var(--fin-r-card)] rounded-bl-sm bg-[var(--fin-card)] px-4 py-3 text-[13px] text-[var(--fin-ink-soft)]">
                  <span className="flex gap-1">
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-[var(--fin-r-pill)] bg-[var(--fin-ink-faint)]"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-[var(--fin-r-pill)] bg-[var(--fin-ink-faint)]"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-[var(--fin-r-pill)] bg-[var(--fin-ink-faint)]"
                      style={{ animationDelay: '300ms' }}
                    />
                  </span>
                  <span>Analizando tus finanzas...</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-[var(--fin-bg)] pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] p-1.5">
          <input
            type="text"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[17px] text-[var(--fin-ink)] border-none shadow-none !outline-none focus:!border-transparent focus:!outline-none focus:!ring-0 focus-visible:!outline-none placeholder:text-[var(--fin-ink-faint)]"
            placeholder="Pregúntale a tu asesor..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] text-[var(--fin-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            <Send className="mr-0.5 h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--fin-ink-faint)]">
          LukApp es una IA y puede cometer errores. Verifica cualquier consejo sobre dinero antes de actuar.
        </p>
      </div>
    </div>
  );
};
