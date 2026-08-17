import { parseTransaction, type ParsedTransaction } from './parseTransaction';
import type { Transaction } from '../types';
import type { Cajita } from '../data/modelos';
import { normalizarNombre } from './contactos';
import type { LexicoAprendido } from './aprendizaje';
import type { CategoriaPersonal } from '../categorias';

export interface AsesorContext {
  ultimoAsunto: string | null;
  ultimaFecha: string | null;
}

export interface AsesorResponse {
  text: string;
  newContext: AsesorContext;
  action?: ParsedTransaction;
}

const VARIANCES = {
  gasto: [
    "Revisando tus números, veo que has gastado **$X** Y Z.",
    "Uff, tienes un total de **$X** registrados Y Z.",
    "Llevas **$X** Y Z. ¡Ojo con ese presupuesto!",
    "Acabo de sumar y tienes **$X** en gastos Y Z."
  ],
  cero: [
    "¡Qué bien! No encontré ningún gasto registrado Y Z.",
    "Todo en cero. No hay transacciones Y Z.",
    "Parece que no has gastado nada Y Z."
  ]
};

function getRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function responderAsesor(
  texto: string,
  transacciones: readonly Transaction[],
  cajitas: readonly Cajita[],
  cajitasBalances: Record<string, number>,
  categorias: readonly CategoriaPersonal[],
  lexico: LexicoAprendido,
  context: AsesorContext
): AsesorResponse {
  const norm = normalizarNombre(texto);
  let newContext = { ...context };

  // 1. Saludos
  if (norm === 'hola' || norm === 'hola asesor' || norm === 'buenas' || norm === 'buenos dias') {
    return {
      text: getRandom([
        '¡Hola! Qué gusto saludarte. Estoy aquí para analizar tus movimientos. ¿De qué quieres que hablemos?',
        '¡Hola! Soy tu asesor privado. ¿Qué dudas tienes sobre tus finanzas hoy?',
        '¡Qué tal! Listo para ayudarte a revisar tus números. Pregúntame lo que necesites.'
      ]),
      newContext
    };
  }

  // 2. Resumen General / Analytics ("como voy", "resumen del mes")
  if (norm.includes('resumen') || (norm.includes('como') && norm.includes('voy'))) {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const mesTxs = transacciones.filter(t => t.occurredOn.startsWith(currentMonth));
    
    const ingresos = mesTxs.filter(t => t.kind === 'ingreso').reduce((sum, t) => sum + t.amountCop, 0);
    const gastos = mesTxs.filter(t => t.kind === 'gasto').reduce((sum, t) => sum + t.amountCop, 0);
    const ahorro = ingresos - gastos;
    const tasaAhorro = ingresos > 0 ? ((ahorro / ingresos) * 100).toFixed(1) : 0;

    let text = `Aquí tienes tu radiografía de este mes:\n\n`;
    text += `💰 **Ingresos:** $${ingresos.toLocaleString('es-CO')}\n`;
    text += `💸 **Gastos:** $${gastos.toLocaleString('es-CO')}\n`;
    
    if (ahorro > 0) {
      text += `📈 **Balance:** +$${ahorro.toLocaleString('es-CO')} (¡Estás ahorrando el ${tasaAhorro}% de lo que entra!)`;
    } else {
      text += `📉 **Balance:** -$${Math.abs(ahorro).toLocaleString('es-CO')} (Estás gastando más de lo que ingresa, ¡cuidado!).`;
    }

    // Top Category
    const porCategoria: Record<string, number> = {};
    mesTxs.filter(t => t.kind === 'gasto').forEach(t => {
      porCategoria[t.category] = (porCategoria[t.category] || 0) + t.amountCop;
    });
    const topCat = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];
    
    if (topCat) {
      text += `\n\nTu categoría de mayor gasto es **${topCat[0]}** con $${topCat[1].toLocaleString('es-CO')}.`;
    }

    return { text, newContext };
  }

  // 3. Consulta de Saldos (Cuentas/Cajitas)
  if (norm.includes('cuanto') && (norm.includes('tengo') || norm.includes('saldo') || norm.includes('dinero') || norm.includes('plata')) && !norm.includes('gastado') && !norm.includes('gaste')) {
    const totalCuentas = cajitas
      .filter((c) => c.tipo === 'cuenta' && c.archivedAt === null)
      .reduce((sum, c) => sum + (cajitasBalances[c.id] || 0), 0);
    const totalAhorro = cajitas
      .filter((c) => c.tipo === 'cajita' && c.archivedAt === null)
      .reduce((sum, c) => sum + (cajitasBalances[c.id] || 0), 0);
    
    const cuentaEspecifica = cajitas.find(c => norm.includes(normalizarNombre(c.nombre)));
    if (cuentaEspecifica) {
      const bal = cajitasBalances[cuentaEspecifica.id] || 0;
      return { text: `En tu cuenta **${cuentaEspecifica.nombre}** tienes un saldo de $${bal.toLocaleString('es-CO')}.`, newContext };
    }

    return { text: `Actualmente tienes **$${totalCuentas.toLocaleString('es-CO')}** disponibles en tus cuentas, y **$${totalAhorro.toLocaleString('es-CO')}** en tus ahorros/bolsillos.`, newContext };
  }

  // 4. Analizar intención usando ParseTransaction
  const cuentasParaElegir = cajitas
    .filter((c) => c.archivedAt === null && c.tipo === 'cuenta')
    .map((c) => ({ id: c.id, nombre: c.nombre, esBajoMonto: false }));

  const intent = parseTransaction(texto, cuentasParaElegir, categorias, lexico, transacciones);
  
  // Is this a statement of a new transaction? (Has amount, doesn't have question words)
  const isQuestion = norm.includes('cuanto') || norm.includes('cual') || norm.includes('?') || norm.includes('total') || norm.includes('dime');
  
  if (!isQuestion && intent.amount && intent.amount > 0) {
    return {
      text: `Veo que mencionas un ${intent.kind} de **$${intent.amount.toLocaleString('es-CO')}** en **${intent.category}**. ¿Quieres que lo registre de una vez en tus finanzas?`,
      newContext,
      action: intent
    };
  }

  // 5. Preguntas de Gastos Contextuales
  if (isQuestion || norm.includes('gasto') || norm.includes('gaste') || norm.includes('gastos')) {
    
    let filtered = transacciones;

    // Use Context Date or Intent Date
    let filterDate = intent.dateOverride || null;
    if (!filterDate && (norm.includes('y ayer') || norm.includes('y hoy'))) {
       // if they say "y ayer", intent dateOverride should normally catch it. If not, we could inject.
       // But intent parser already handles "ayer".
    } else if (!filterDate && context.ultimaFecha && norm.match(/^y en /)) {
       // Si dice "y en comida?" y veniamos hablando de una fecha especifica, la mantenemos.
       filterDate = context.ultimaFecha;
    }

    if (filterDate) {
      filtered = filtered.filter(t => t.occurredOn === filterDate);
      newContext.ultimaFecha = filterDate;
    } else {
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      filtered = filtered.filter(t => t.occurredOn.startsWith(currentMonth));
      newContext.ultimaFecha = null;
    }

    // Use Context Category or Intent Category
    let asunto = 'total';
    if (intent.signals.categorySource !== 'default' || norm.includes(intent.description.toLowerCase())) {
      filtered = filtered.filter(t => 
        t.category === intent.category || 
        normalizarNombre(t.description).includes(normalizarNombre(intent.description)) ||
        normalizarNombre(t.description).includes(normalizarNombre(texto.replace('cuanto', '').replace('he', '').replace('gastado', '').replace('en', '')))
      );
      asunto = intent.category;
      newContext.ultimoAsunto = asunto;
    } else if (context.ultimoAsunto && norm.match(/^(y )?(el|este) (mes|año|dia)/)) {
      // Si dice "y este mes?" y veniamos hablando de comida, recordamos comida.
      filtered = filtered.filter(t => t.category === context.ultimoAsunto);
      asunto = context.ultimoAsunto;
    }

    const tipo = (norm.includes('ingreso') || norm.includes('gane') || norm.includes('recibi')) ? 'ingreso' : 'gasto';
    filtered = filtered.filter(t => t.kind === tipo);

    const total = filtered.reduce((acc, t) => acc + t.amountCop, 0);

    let fechaStr = filterDate ? `el ${filterDate}` : 'este mes';
    const concepto = asunto === 'total' ? 'en general' : `en **${asunto}**`;

    if (filtered.length === 0) {
      return { text: getRandom(VARIANCES.cero).replace('X', total.toLocaleString('es-CO')).replace('Y', concepto).replace('Z', fechaStr), newContext };
    }

    return { text: getRandom(VARIANCES.gasto).replace('X', total.toLocaleString('es-CO')).replace('Y', concepto).replace('Z', fechaStr) + ` (en ${filtered.length} transacciones).`, newContext };
  }

  return { text: 'No estoy seguro de entender... Recuerda que puedes preguntarme cosas como: "¿Cuánto gasté en Rappi este mes?", "Hazme un resumen del mes" o simplemente escribirme un gasto: "Ayer me gasté 20 mil en pizza" para que lo anote.', newContext };
}
