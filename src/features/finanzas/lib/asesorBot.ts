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

  // 1. Chitchat y Personalidad
  if (norm.match(/^(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos|que tal|q tal)/)) {
    return {
      text: getRandom([
        '¡Hola! Soy tu Asesor Financiero personal. Mi cerebro vive directo en tu dispositivo, así que tus datos están seguros conmigo. ¿En qué te puedo ayudar hoy?',
        '¡Hola! Listo para revisar tus números. Puedes preguntarme sobre tus gastos, tus saldos o pedirme un resumen del mes. ¿Qué revisamos?',
        '¡Qué tal! Siempre es buen momento para cuidar la plata. ¿Qué duda financiera tienes hoy?'
      ]),
      newContext
    };
  }
  
  if (norm.match(/quien (eres|sos)|que eres|como te llamas/)) {
    return {
      text: 'Soy el Asesor de Focus. Soy una red de reglas lógicas y análisis semántico que funciona 100% offline en tu celular. No soy GPT, ¡pero me esfuerzo igual para cuidar tu bolsillo!',
      newContext
    };
  }
  if (norm.match(/gracias|te amo|excelente|genial|buen trabajo/)) {
    return {
      text: getRandom([
        '¡Con todo gusto! Para eso estoy. Si necesitas algo más, aquí sigo.',
        '¡De nada! Recuerda que un peso ahorrado es un peso ganado. ¿Deseas ver algo más?',
        '¡Me alegra ayudar! Cuidar tus finanzas es mi pasión.'
      ]),
      newContext
    };
  }

  // 2. Resumen General / Analytics y "Opiniones" ("como voy", "resumen del mes", "estoy gastando mucho?")
  if (norm.includes('resumen') || norm.includes('como voy') || norm.includes('como me ves') || norm.includes('gastando mucho') || norm.includes('analisis')) {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const mesTxs = transacciones.filter(t => t.occurredOn.startsWith(currentMonth));
    
    const ingresos = mesTxs.filter(t => t.kind === 'ingreso').reduce((sum, t) => sum + t.amountCop, 0);
    const gastos = mesTxs.filter(t => t.kind === 'gasto').reduce((sum, t) => sum + t.amountCop, 0);
    const ahorro = ingresos - gastos;
    const tasaAhorro = ingresos > 0 ? ((ahorro / ingresos) * 100).toFixed(1) : 0;

    let text = `Aquí tienes tu radiografía financiera de este mes:\n\n`;
    text += `💰 **Ingresos:** $${ingresos.toLocaleString('es-CO')}\n`;
    text += `💸 **Gastos:** $${gastos.toLocaleString('es-CO')}\n`;
    
    if (ahorro > 0) {
      text += `📈 **Balance:** +$${ahorro.toLocaleString('es-CO')} (¡Ahorrando el ${tasaAhorro}%!)\n\n`;
      if (Number(tasaAhorro) > 20) {
        text += '🤖 **Mi Análisis:** ¡Estás volando! Ahorrar más del 20% es el sueño de cualquier financiero. Sigue así y vas a construir un colchón muy sólido.';
      } else {
        text += '🤖 **Mi Análisis:** Vas por buen camino, estás en verde. Intenta no subir los gastos de aquí a fin de mes para mantener ese ahorro.';
      }
    } else if (ahorro === 0 && ingresos === 0) {
      text += `\n🤖 **Mi Análisis:** Este mes no has registrado movimientos todavía. ¡Anímate a registrar tus primeros gastos o ingresos para darte un buen diagnóstico!`;
    } else {
      text += `📉 **Balance:** -$${Math.abs(ahorro).toLocaleString('es-CO')}\n\n`;
      text += '🤖 **Mi Análisis:** ¡Alerta roja! 🚨 Estás gastando más de lo que ha entrado este mes. Toca apretarse el cinturón o revisar si te faltó registrar algún ingreso.';
    }

    // Top Category
    const porCategoria: Record<string, number> = {};
    mesTxs.filter(t => t.kind === 'gasto').forEach(t => {
      porCategoria[t.category] = (porCategoria[t.category] || 0) + t.amountCop;
    });
    const topCat = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0];
    
    if (topCat && topCat[1] > 0) {
      text += `\n\nPor cierto, tu "agujero negro" de dinero este mes es **${topCat[0]}** con $${topCat[1].toLocaleString('es-CO')}... ten cuidado con eso.`;
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
    } else if (norm.includes('mes pasado') || norm.includes('mes anterior')) {
      const lm = new Date();
      lm.setMonth(lm.getMonth() - 1);
      const lmKey = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`;
      filtered = filtered.filter(t => t.occurredOn.startsWith(lmKey));
      newContext.ultimaFecha = lmKey;
      filterDate = lmKey;
    } else if (norm.includes('año pasado')) {
      const ly = new Date().getFullYear() - 1;
      filtered = filtered.filter(t => t.occurredOn.startsWith(String(ly)));
      newContext.ultimaFecha = String(ly);
      filterDate = String(ly);
    } else if (norm.includes('este año') || norm.includes('el año')) {
      const cy = new Date().getFullYear();
      filtered = filtered.filter(t => t.occurredOn.startsWith(String(cy)));
      newContext.ultimaFecha = String(cy);
      filterDate = String(cy);
    } else {
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      filtered = filtered.filter(t => t.occurredOn.startsWith(currentMonth));
      newContext.ultimaFecha = null;
    }

    // Use Context Category or Intent Category
    let asunto = 'total';
    
    // Fuzzy match manual si no hay signals directos del parser
    const palabras = norm.split(' ');
    let fuzzyCat: string | null = null;
    const catNombres = categorias.map(c => normalizarNombre(c.nombre));
    for (const p of palabras) {
      if (p.length < 4) continue;
      // Levenshtein simplificado o startsWith/endsWith
      const match = catNombres.find(c => c.includes(p) || p.includes(c) || c === p);
      if (match) {
        fuzzyCat = categorias.find(c => normalizarNombre(c.nombre) === match)?.id || match;
        break;
      }
    }

    const isMeaningfulDescription = intent.description && intent.description.length > 2 && !['este', 'mes', 'dia', 'ayer', 'hoy', 'cuanto', 'gastado', 'gaste', 'total', 'año', 'pasado', 'semana'].includes(normalizarNombre(intent.description));

    if (intent.signals.categorySource !== 'default' || isMeaningfulDescription || fuzzyCat) {
      const catFinal = intent.signals.categorySource !== 'default' ? intent.category : (fuzzyCat || intent.category);
      filtered = filtered.filter(t => 
        t.category === catFinal || 
        (isMeaningfulDescription && normalizarNombre(t.description).includes(normalizarNombre(intent.description))) ||
        (fuzzyCat && t.category === fuzzyCat)
      );
      asunto = intent.signals.categorySource !== 'default' ? intent.category : (fuzzyCat || intent.description || 'varios');
      newContext.ultimoAsunto = asunto;
    } else if (context.ultimoAsunto && norm.match(/^(y )?(el|este) (mes|año|dia|semana)/)) {
      // Si dice "y este mes?" y veniamos hablando de comida, recordamos comida.
      filtered = filtered.filter(t => t.category === context.ultimoAsunto);
      asunto = context.ultimoAsunto;
    }

    const tipo = (norm.includes('ingreso') || norm.includes('gane') || norm.includes('recibi')) ? 'ingreso' : 'gasto';
    filtered = filtered.filter(t => t.kind === tipo);

    const total = filtered.reduce((acc, t) => acc + t.amountCop, 0);

    let fechaStr = filterDate ? (filterDate.length === 7 ? `en el mes de ${filterDate}` : (filterDate.length === 4 ? `en el año ${filterDate}` : `el ${filterDate}`)) : 'este mes';
    if (norm.includes('año pasado')) fechaStr = 'el año pasado';
    else if (norm.includes('mes pasado') || norm.includes('mes anterior')) fechaStr = 'el mes pasado';
    
    const concepto = asunto === 'total' ? 'en general' : `en **${asunto}**`;

    if (filtered.length === 0) {
      return { text: getRandom(VARIANCES.cero).replace('X', total.toLocaleString('es-CO')).replace('Y', concepto).replace('Z', fechaStr), newContext };
    }
    
    // Comparativa mes pasado (Magic AI feel)
    if (tipo === 'gasto' && filterDate === null && !norm.includes('año')) {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lmKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
      
      const lastMonthTotal = transacciones
        .filter(t => t.occurredOn.startsWith(lmKey) && t.kind === 'gasto' && (asunto === 'total' || t.category === asunto || (isMeaningfulDescription && normalizarNombre(t.description).includes(normalizarNombre(intent.description)))))
        .reduce((sum, t) => sum + t.amountCop, 0);
        
      if (lastMonthTotal > 0) {
        const diff = total - lastMonthTotal;
        const tendencia = diff > 0 
          ? `(⚠️ **$${Math.abs(diff).toLocaleString('es-CO')} más** que el mes pasado a esta fecha)`
          : `(✅ **$${Math.abs(diff).toLocaleString('es-CO')} menos** que el mes pasado, ¡bien!)`;
        
        return { text: getRandom(VARIANCES.gasto).replace('X', total.toLocaleString('es-CO')).replace('Y', concepto).replace('Z', fechaStr) + ` ${tendencia}`, newContext };
      }
    }

    return { text: getRandom(VARIANCES.gasto).replace('X', total.toLocaleString('es-CO')).replace('Y', concepto).replace('Z', fechaStr) + ` (en ${filtered.length} transacciones).`, newContext };
  }

  // Fallback a LLM-like
  if (norm.length > 30 && !norm.includes('gaste') && !norm.includes('gastado')) {
    return { text: '¡Esa es una pregunta profunda! Como soy una IA local basada en reglas, soy experto en buscar sumas, fechas y gastos exactos, pero me cuesta leer párrafos muy largos. Prueba preguntándome montos o resúmenes directos.', newContext };
  }

  // ELIZA-like Chitchat Fallback
  const chitchatRules: Array<{ regex: RegExp, responses: string[] }> = [
    {
      regex: /me (entiendes|comprendes|escuchas)/i,
      responses: [
        '¡Te entiendo perfectamente! Aunque mi lenguaje principal son los números y las finanzas, hago mi mejor esfuerzo por procesar todo lo que dices. ¿De qué te gustaría hablar?',
        'Claro que sí. Leo tus mensajes en tiempo real. Soy mejor calculando gastos que filosofando, ¡pero aquí estoy para ti!'
      ]
    },
    {
      regex: /(eres|sos) (inteligente|bruto|tonto|ia|robot)/i,
      responses: [
        'Hago lo mejor que puedo con mis algoritmos. No soy tan grande como ChatGPT, pero tengo la ventaja de que vivo en tu dispositivo y protejo tu privacidad al 100%.',
        'Soy una inteligencia especializada. Pregúntame sobre tus finanzas y verás cómo hago magia con tus números.'
      ]
    },
    {
      regex: /(jaja|jeje|jiji|lol|lmao|xdd)/i,
      responses: [
        '¡Jaja! 😄 Siempre es bueno mantener el humor, sobre todo cuando hablamos de plata.',
        'Me alegra que te diviertas. ¡Las finanzas no tienen por qué ser aburridas!'
      ]
    },
    {
      regex: /que (puedes|sabes) hacer/i,
      responses: [
        'Puedo hacer muchas cosas: preguntarme cuánto gastaste en algo, pedirme un resumen del mes, comparar tus gastos con el mes pasado, o incluso decirme directamente "ayer gasté 20 lucas en cine" para que lo anote por ti.',
        'Mi especialidad es tu bolsillo. Pregúntame sobre tus gastos en fechas específicas, pídeme un resumen financiero, o dime cuánto gastaste en algo para que lo sume a tus cuentas.'
      ]
    },
    {
      regex: /como (te sientes|estas)/i,
      responses: [
        '¡Funcionando al 100% de mi capacidad de procesamiento local! Listo para analizar tus transacciones.',
        'Muy bien, con todos mis circuitos enfocados en cuidar tu presupuesto. ¿Cómo estás tú?'
      ]
    },
    {
      regex: /te (amo|quiero)/i,
      responses: [
        '¡Yo también aprecio que confíes en mí para cuidar tus finanzas! 💜',
        '¡Aww! Yo solo quiero ver crecer tus ahorros. 💰'
      ]
    },
    {
      regex: /chao|adios|hasta luego|nos vemos/i,
      responses: [
        '¡Hasta pronto! Aquí estaré guardando tus finanzas bajo llave.',
        '¡Nos vemos! Recuerda pensar dos veces antes de ese "gasto hormiga". 😉'
      ]
    },
    {
      regex: /estoy (triste|feliz|cansado|aburrido)/i,
      responses: [
        'Entiendo que te sientas así. A veces ordenar las finanzas ayuda a tener una mente más tranquila. ¿Quieres que miremos tus números para ver si hay buenas noticias?',
        'Tomo nota de cómo te sientes. Si quieres distraerte un poco, podemos revisar tu balance o buscar oportunidades de ahorro.'
      ]
    },
    {
      regex: /estoy (quebrado|pobre|sin plata|arruinado)/i,
      responses: [
        '¡Tranquilo! Las malas rachas pasan. Lo importante es empezar a registrar cada peso para saber por dónde se está fugando el dinero. Si quieres, dime un resumen de lo que tienes ahora mismo en el bolsillo y empezamos desde ahí.',
        'A todos nos pasa. El primer paso para mejorar es medir. Intenta no gastar más de lo necesario esta semana y revisemos tu resumen en unos días.'
      ]
    }
  ];

  for (const rule of chitchatRules) {
    if (rule.regex.test(norm)) {
      return { text: getRandom(rule.responses), newContext };
    }
  }

  // Fallback final
  return { 
    text: getRandom([
      'Mmm, creo que no te copié bien. Recuerda que puedes preguntarme cosas puntuales como: "¿Cuánto gasté en Rappi?", "Hazme un resumen" o directamente un gasto: "Gasté 20 mil en pizza".',
      'No logré procesar eso con mis reglas financieras. Intenta preguntarme por categorías, fechas o saldos específicos.',
      'Me quedé procesando... soy experto en gastos e ingresos, pero aún estoy aprendiendo a tener charlas libres. ¿Probamos preguntándome tu saldo o tus gastos del mes?'
    ]), 
    newContext 
  };
}
