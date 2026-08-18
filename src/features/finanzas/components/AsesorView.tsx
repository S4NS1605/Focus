import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, BrainCircuit } from 'lucide-react';
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
export const etiquetaConexion = (
  estado: EstadoConexion,
  ahora: Date = new Date(),
): string => {
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
const SUGERENCIAS_INICIALES = ['Dime mi resumen', '¿Cuánto puedo gastar?', 'Mis suscripciones', 'Sorpréndeme'];

const renderMarkdownLine = (line: string) => {
  const parts = line.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

export const AsesorView: React.FC<AsesorViewProps> = ({ transacciones, cajitas, cajitasBalances, categorias, lexico, onCrearTransaccion }) => {
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
      const txMes = transacciones.filter(t => t.occurredOn.startsWith(mesActual));
      const gastosMes = txMes.filter(t => t.kind === 'gasto').reduce((acc, t) => acc + t.amountCop, 0);
      const ingresosMes = txMes.filter(t => t.kind === 'ingreso').reduce((acc, t) => acc + t.amountCop, 0);

      const finanzasContext = {
        mes: mesActual,
        gastosEsteMesCop: gastosMes,
        ingresosEsteMesCop: ingresosMes,
        balanceMesCop: ingresosMes - gastosMes,
        cuentas: cajitas.filter(c => !c.archivedAt && !ES_PASIVO[c.tipo]).map(c => ({
          nombre: c.nombre,
          saldoCop: cajitasBalances[c.id] ?? 0,
        })),
        deudas: cajitas.filter(c => !c.archivedAt && ES_PASIVO[c.tipo]).map(c => ({
          nombre: c.nombre,
          deudaCop: cajitasBalances[c.id] ?? 0,
        })),
        topCategoriasGasto: Array.from(
          txMes.filter(t => t.kind === 'gasto').reduce((map, t) => {
            map.set(t.category, (map.get(t.category) || 0) + t.amountCop);
            return map;
          }, new Map<string, number>()).entries()
        ).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, total]) => ({ categoria: cat, totalCop: total })),
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
              const deteccion = detectarMovimiento(textoUsuario, transacciones, cajitas, categorias, lexico, context);
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
        const { text: respuesta, newContext, action, actions, suggestions } = responderAsesor(
          textoUsuario,
          transacciones,
          cajitas,
          cajitasBalances,
          categorias,
          lexico,
          context
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

  return (
    <div className="flex h-full flex-col bg-[var(--fin-bg)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--fin-line)] bg-[var(--fin-bg-soft)] px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400">
          <BrainCircuit className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-[var(--fin-ink)]">Tu Asesor Financiero</h2>
          {/* El estado se dice tal cual es: en línea con IA, despertando, o
              respondiendo en local. Fingir "en línea" mientras contesta el motor
              de reglas sería mentirle a quien pregunta. */}
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--fin-ink-soft)]">
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                conexion === 'en-linea'
                  ? 'animate-pulse bg-emerald-500'
                  : conexion === 'despertando'
                    ? 'animate-pulse bg-amber-500'
                    : 'bg-[var(--fin-ink-soft)]'
              }`}
            />
            <span className="truncate">{etiquetaConexion(conexion)}</span>
          </p>
        </div>
      </div>

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
          <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-5 text-center">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-500/25">
              <BrainCircuit className="h-8 w-8" strokeWidth={2} />
              <span
                aria-hidden="true"
                className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full ring-4 ring-[var(--fin-bg)] ${
                  conexion === 'en-linea'
                    ? 'animate-pulse bg-emerald-500'
                    : conexion === 'despertando'
                      ? 'animate-pulse bg-amber-500'
                      : 'bg-[var(--fin-ink-faint)]'
                }`}
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--fin-ink)]">Tu Asesor Financiero</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--fin-ink-soft)]">
                {messages[0].text}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGERENCIAS_INICIALES.map((sug) => (
                <button
                  key={sug}
                  onClick={() => handleSend(sug)}
                  disabled={pensando}
                  className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3.5 py-1.5 text-[13px] font-semibold text-fuchsia-700 transition-colors hover:bg-fuchsia-100 disabled:opacity-50 dark:border-fuchsia-900/50 dark:bg-fuchsia-900/20 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/40"
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
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  msg.role === 'user'
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <Bot className="h-4 w-4" strokeWidth={2.5} />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'rounded-br-sm bg-blue-600 text-white dark:bg-blue-500'
                    : 'rounded-bl-sm border border-[var(--fin-line)] bg-[var(--fin-card)] text-[var(--fin-ink)]'
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
                      className="w-full rounded-xl bg-fuchsia-600 px-3 py-2 text-[13px] font-bold text-white transition-colors hover:bg-fuchsia-500"
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
                        className="w-full rounded-xl bg-fuchsia-600 px-3 py-2 text-[13px] font-bold text-white transition-colors hover:bg-fuchsia-500"
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
                        className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-[12px] font-medium text-fuchsia-700 transition-colors hover:bg-fuchsia-100 disabled:opacity-50 dark:border-fuchsia-900/50 dark:bg-fuchsia-900/20 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/40"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {pensando && (
            <div className="flex items-end gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400">
                <Bot className="h-4 w-4 animate-pulse" strokeWidth={2.5} />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3 text-[13px] text-[var(--fin-ink-soft)]">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fuchsia-500" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fuchsia-500" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fuchsia-500" style={{ animationDelay: '300ms' }} />
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
      <div className="border-t border-[var(--fin-line)] bg-[var(--fin-bg-soft)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-bg)] p-1.5 shadow-sm focus-within:border-fuchsia-500/50 focus-within:ring-2 focus-within:ring-fuchsia-500/20">
          <input
            type="text"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-base text-[var(--fin-ink)] border-none shadow-none !outline-none focus:!border-transparent focus:!outline-none focus:!ring-0 focus-visible:!outline-none placeholder:text-[var(--fin-ink-faint)]"
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-600 text-white shadow-sm transition-colors hover:bg-fuchsia-500 disabled:opacity-50 dark:bg-fuchsia-500 dark:hover:bg-fuchsia-400"
          >
            <Send className="mr-0.5 h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};
