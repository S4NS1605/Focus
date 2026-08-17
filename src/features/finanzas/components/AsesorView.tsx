import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, BrainCircuit } from 'lucide-react';
import type { Transaction } from '../types';
import type { Cajita } from '../data/modelos';
import { responderAsesor, type AsesorContext } from '../lib/asesorBot';
import type { ParsedTransaction } from '../lib/parseTransaction';

import type { LexicoAprendido } from '../lib/aprendizaje';
import type { CategoriaPersonal } from '../categorias';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  action?: ParsedTransaction;
}

interface AsesorViewProps {
  transacciones: readonly Transaction[];
  cajitas: readonly Cajita[];
  cajitasBalances: Record<string, number>;
  categorias: readonly CategoriaPersonal[];
  lexico: LexicoAprendido;
  onCrearTransaccion?: (tx: ParsedTransaction) => void;
}

const nuevoId = () => `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: nuevoId(), role: 'user', text: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulate thinking delay for better UX
    setTimeout(() => {
      const { text: respuesta, newContext, action } = responderAsesor(userMsg.text, transacciones, cajitas, cajitasBalances, categorias, lexico, context);
      setContext(newContext);
      const botMsg: Message = { id: nuevoId(), role: 'bot', text: respuesta, action };
      setMessages((prev) => [...prev, botMsg]);
    }, 400);
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
        <div>
          <h2 className="text-[15px] font-bold text-[var(--fin-ink)]">Tu Asesor Financiero</h2>
          <p className="text-[13px] text-[var(--fin-ink-soft)]">100% Privado y Local</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5">
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
                {msg.text.split('\\n').map((line, i) => (
                  <React.Fragment key={i}>
                    {renderMarkdownLine(line)}
                    {i !== msg.text.split('\\n').length - 1 && <br />}
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
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[var(--fin-line)] bg-[var(--fin-bg-soft)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-bg)] p-1.5 shadow-sm focus-within:border-fuchsia-500/50 focus-within:ring-2 focus-within:ring-fuchsia-500/20">
          <input
            type="text"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[15px] text-[var(--fin-ink)] outline-none placeholder:text-[var(--fin-ink-faint)]"
            placeholder="Pregúntale a tu asesor..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            type="button"
            onClick={handleSend}
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
