import { parseTransaction, type ParsedTransaction } from './parseTransaction';
import type { Transaction } from '../types';
import type { Cajita } from '../data/modelos';
import { normalizarNombre } from './contactos';
import type { LexicoAprendido } from './aprendizaje';
import type { CategoriaPersonal } from '../categorias';

export interface AsesorContext {
  ultimoAsunto: string | null;
  ultimaFecha: string | null;
  _isRecursive?: boolean;
  lastInsightIdx?: number;
}

export interface AsesorResponse {
  text: string;
  newContext: AsesorContext;
  action?: ParsedTransaction;
  actions?: ParsedTransaction[];
  suggestions?: string[];
}

const VARIANCES = {
  gasto: [
    "Mmm, revisando tus números, veo que en Y Z se te han ido **$X**.",
    "Haciendo cuentas, llevas **$X** gastados en Y Z. ¡Ojo ahí!",
    "Acabo de sumar todo y tienes **$X** en Y Z.",
    "Pues mira, tienes registrados **$X** en Y Z.",
    "Revisé la caja fuerte virtual y veo **$X** en Y Z.",
    "Te confirmo que el total en Y Z suma **$X**."
  ],
  ingreso: [
    "¡Buenas noticias! Revisando tus números, veo que te han entrado **$X** por Y Z.",
    "Haciendo cuentas, has recibido **$X** en Y Z. ¡A seguir sumando!",
    "Acabo de sumar todo y tienes **$X** de ingresos en Y Z.",
    "Pues mira, lograste generar **$X** en Y Z. ¡Excelente trabajo!"
  ],
  cero_gasto: [
    "¡Qué bien! No veo ni un solo peso gastado en Y Z.",
    "Todo en cero. No hay transacciones de eso Z.",
    "Parece que te portaste bien: no has gastado nada en Y Z."
  ],
  cero_ingreso: [
    "Aún no veo ingresos registrados en Y Z.",
    "Por ahora, no hay plata entrando por Y Z.",
    "Todo en cero en cuanto a ingresos Z. ¡A buscar nuevas oportunidades!"
  ]
};

function getRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface DeteccionMovimiento {
  /**
   * Lo que el parser entendió de la frase completa, se haya podido proponer o
   * no. El resto del enrutador de `responderAsesor` lo sigue necesitando
   * (fecha, categoría, descripción) incluso cuando esto no resultó ser un
   * movimiento que registrar.
   */
  intent: ParsedTransaction;
  newContext: AsesorContext;
  /**
   * Listo para devolver tal cual si la frase describe uno o varios
   * movimientos con monto real. `null` si es una pregunta, si falta el
   * monto, o si el monto es demasiado débil para fiarse (ej. "cien" suelto
   * sin "pesos"/"dólares" al lado, que casi siempre es otra cosa).
   */
  propuesta: { text: string; action?: ParsedTransaction; actions?: ParsedTransaction[] } | null;
}

/**
 * Si lo dictado describe uno o varios movimientos reales, listos para
 * proponer con confirmación.
 *
 * Esta es la ÚNICA puerta por la que un movimiento entra al libro desde el
 * asesor, la use el motor de reglas local (aquí abajo, en `responderAsesor`)
 * o el modelo en línea (desde `AsesorView`, después de que el LLM ya
 * contestó en prosa). El LLM puede redactar lo que quiera; lo que decide el
 * monto, la categoría y si hay algo que guardar es siempre `parseTransaction`
 * — determinista, local, el mismo camino para los dos casos. Así una
 * respuesta bonita del modelo nunca puede "inventar" un registro que el
 * parser no confirme de forma independiente.
 */
export const detectarMovimiento = (
  texto: string,
  transacciones: readonly Transaction[],
  cajitas: readonly Cajita[],
  categorias: readonly CategoriaPersonal[],
  lexico: LexicoAprendido,
  context: AsesorContext,
): DeteccionMovimiento => {
  const norm = normalizarNombre(texto);
  const newContext = { ...context };

  const cuentasParaElegir = cajitas
    .filter((c) => c.archivedAt === null && c.tipo === 'cuenta')
    .map((c) => ({ id: c.id, nombre: c.nombre, esBajoMonto: false }));

  const isQuestion = norm.includes('cuanto') || norm.includes('cual') || norm.includes('?') || norm.includes('total') || norm.includes('dime');

  // Multi-Transaction NLP Router (ej. "gaste 50 en comida, 20 en transporte y 100 en cine")
  if (!isQuestion && !context._isRecursive) {
    const separadores = / y |,| e | luego /;
    const parts = norm.split(separadores).map(p => p.trim()).filter(p => p.length > 4);
    const partsWithNumbers = parts.filter(p => /\d/.test(p));

    if (partsWithNumbers.length > 1) {
      const allActions: ParsedTransaction[] = [];
      let combinedText = "¡Guau, a la velocidad de la luz! Detecté varias transacciones de una sola pasada:\n\n";

      let lastKind = 'gasto'; // Default propagation
      for (const part of partsWithNumbers) {
        const partToParse = (part.includes('gaste') || part.includes('pague') || part.includes('me pagaron')) ? part : (lastKind === 'ingreso' ? 'me pagaron ' : 'gaste ') + part;

        const subIntent = parseTransaction(partToParse, cuentasParaElegir, categorias, lexico, transacciones);
        if (subIntent && subIntent.amount && subIntent.amount > 0) {
          lastKind = subIntent.kind;

          if ((subIntent.category === 'otros' || !subIntent.category) && context.ultimoAsunto) {
            subIntent.category = context.ultimoAsunto;
          }

          allActions.push(subIntent);
          combinedText += `• Un ${subIntent.kind} de **$${subIntent.amount.toLocaleString('es-CO')}** en **${subIntent.category}**.\n`;
        }
      }

      if (allActions.length > 1) {
        newContext.ultimoAsunto = allActions[allActions.length - 1].category;
        return {
          intent: allActions[allActions.length - 1],
          newContext,
          propuesta: {
            text: combinedText + "\nRevisa los botones abajo y dale clic a cada uno para registrarlos.",
            actions: allActions,
          },
        };
      }
    }
  }

  // Single Transaction
  const intent = parseTransaction(texto, cuentasParaElegir, categorias, lexico, transacciones);

  if (intent.amount && intent.amount > 0 && intent.category === 'otros' && context.ultimoAsunto) {
    intent.category = context.ultimoAsunto;
    intent.description = intent.description || `Adición a ${context.ultimoAsunto}`;
  }

  const isWeakAmount = intent.amount !== null && intent.amount < 100 && intent.signals.amountSource === 'words' && !norm.includes('peso') && !norm.includes('dolar') && !norm.includes('euro');

  if (!isQuestion && intent.amount && intent.amount > 0 && !isWeakAmount) {
    newContext.ultimoAsunto = intent.category;

    let alertText = "";
    if (intent.kind === 'gasto' && intent.category !== 'otros') {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const totalMonthCategory = transacciones
        .filter(t => t.kind === 'gasto' && t.category === intent.category && t.occurredOn.startsWith(currentMonth))
        .reduce((sum, t) => sum + t.amountCop, 0);

      const newTotal = totalMonthCategory + intent.amount;

      const pastTxs = transacciones.filter(t => t.kind === 'gasto' && t.category === intent.category && !t.occurredOn.startsWith(currentMonth));
      if (pastTxs.length > 2) {
        const pastMonths = new Set(pastTxs.map(t => t.occurredOn.substring(0, 7))).size || 1;
        const pastSum = pastTxs.reduce((sum, t) => sum + t.amountCop, 0);
        const avgMonth = pastSum / pastMonths;

        if (newTotal > avgMonth * 1.2) {
          alertText = `\n\n⚠️ **Alerta Proactiva:** Con este gasto llegarás a **$${newTotal.toLocaleString('es-CO')}** en ${intent.category} este mes. ¡Eso es un 20% más de tu promedio mensual habitual ($${Math.round(avgMonth).toLocaleString('es-CO')})! Trata de frenar aquí.`;
        } else if (newTotal > avgMonth * 0.9) {
          alertText = `\n\n💡 **Ojo ahí:** Con este gasto ya estás rozando tu promedio habitual en ${intent.category}. Cuidado con lo que quede del mes.`;
        }
      }
    }

    return {
      intent,
      newContext,
      propuesta: {
        text: `Veo que mencionas un ${intent.kind} de **$${intent.amount.toLocaleString('es-CO')}** en **${intent.category}**. ¿Quieres que lo registre de una vez en tus finanzas?${alertText}`,
        action: intent,
      },
    };
  }

  return { intent, newContext, propuesta: null };
};

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

  // 0. Multi-Query NLP Router (ej. "cuanto tengo en cuentas y cuanto gaste en rappi")
  if (!context._isRecursive && norm.includes(' y ') && !norm.startsWith('y ') && !norm.includes('ayer') && !norm.includes('hoy')) {
    const parts = norm.split(' y ');
    // Intentar partir la oración en dos preguntas completas si son suficientemente largas
    if (parts.length === 2 && parts[0].length > 6 && parts[1].length > 6) {
      const p1 = parts[0];
      // Restauramos la intención natural a la segunda parte (ej. si la parte 1 es "dime mi saldo", la 2 es "cuanto gaste en comida")
      const p2 = parts[1].includes('cuanto') ? parts[1] : (parts[0].includes('cuanto') ? 'cuanto ' + parts[1] : parts[1]);
      
      const r1 = responderAsesor(p1, transacciones, cajitas, cajitasBalances, categorias, lexico, { ...context, _isRecursive: true });
      const r2 = responderAsesor(p2, transacciones, cajitas, cajitasBalances, categorias, lexico, { ...r1.newContext, _isRecursive: true });
      
      // Solo combinamos si ninguna de las dos falló al fallback de chitchat
      if (!r1.text.includes('No logré procesar') && !r2.text.includes('No logré procesar') && !r1.text.includes('Mmm, creo que no te copié')) {
        // Si cualquiera de las dos mitades propuso un movimiento, ese `action`
        // tiene que sobrevivir a la combinación. Sin esto, "gasté 50 mil en
        // comida y 20 mil en transporte" mostraba los dos montos en el texto
        // pero perdía los botones de confirmar — cada mitad los llevaba en su
        // propia respuesta y aquí se armaba solo `text`, tirando el resto.
        const accionesCombinadas = [
          ...(r1.actions ?? (r1.action ? [r1.action] : [])),
          ...(r2.actions ?? (r2.action ? [r2.action] : [])),
        ];

        return {
          text: `${r1.text}\n\n**Por otro lado...**\n${r2.text}`,
          newContext: { ...r2.newContext, _isRecursive: false },
          ...(accionesCombinadas.length === 1
            ? { action: accionesCombinadas[0] }
            : accionesCombinadas.length > 1
              ? { actions: accionesCombinadas }
              : {}),
        };
      }
    }
  }

  // Saludos dinámicos por hora del día
  if (norm.match(/^(hola|buenas|buenos dias|buenas tardes|buenas noches|saludos|que tal|q tal)/)) {
    const hora = new Date().getHours();
    let saludo = '¡Hola!';
    if (hora < 12) saludo = '¡Buenos días!';
    else if (hora < 19) saludo = '¡Buenas tardes!';
    else saludo = '¡Buenas noches!';

    return {
      text: getRandom([
        `${saludo} Por aquí estoy, revisando tus números. ¿En qué te ayudo hoy?`,
        `${saludo} Listo para hacer cuentas. ¿Qué quieres que revisemos?`,
        `${saludo} Siempre es buen momento para organizar la plata. ¡Dime qué necesitas!`
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

  // 1.5 Memoria de Edición al Vuelo (Correcciones)
  if (context.ultimoAsunto && (norm.startsWith('fueron ') || norm.startsWith('era ') || norm.startsWith('eran ') || norm.includes('corrijo') || norm.includes('ah no,'))) {
    const intent = parseTransaction(texto, [], categorias, lexico, transacciones);
    if (intent.amount && intent.amount > 0) {
      intent.category = context.ultimoAsunto;
      intent.description = `Corrección en ${context.ultimoAsunto}`;
      return {
        text: `¡Listo! Entendido, en realidad fueron **$${intent.amount.toLocaleString('es-CO')}** en **${context.ultimoAsunto}**. (Recuerda que para eliminar el registro erróneo anterior, debes deslizarlo en la pestaña Movimientos). ¿Registro este nuevo monto corregido?`,
        newContext,
        action: intent
      };
    }
  }

  // 2. Resumen General / Analytics y "Opiniones" ("como voy", "resumen del mes", "estoy gastando mucho?")
  if (norm.includes('resumen') || norm.includes('como voy') || norm.includes('como me ves') || norm.includes('como ves') || norm.includes('finanzas') || norm.includes('gastando mucho') || norm.includes('analisis')) {
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

    // Biggest Transaction
    const biggestTx = mesTxs.filter(t => t.kind === 'gasto').sort((a, b) => b.amountCop - a.amountCop)[0];
    if (biggestTx && biggestTx.amountCop > 0) {
      text += `\nTu compra más grande fue de **$${biggestTx.amountCop.toLocaleString('es-CO')}** en ${biggestTx.category} el ${biggestTx.occurredOn}.`;
    }

    // Financial Projection (Burn Rate)
    if (gastos > 0 && today.getDate() > 3) {
      const burnRate = gastos / today.getDate();
      const ultimoDia = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const proyeccion = burnRate * ultimoDia;
      
      text += `\n\n🔮 **Proyección a fin de mes:** Al ritmo que llevas ($${Math.round(burnRate).toLocaleString('es-CO')} diarios), terminarás gastando unos **$${Math.round(proyeccion).toLocaleString('es-CO')}** en total este mes. `;
      
      if (proyeccion > ingresos && ingresos > 0) {
        text += `¡Ojo! Eso es más de lo que ha ingresado.`;
      } else if (ingresos > 0) {
        text += `¡Súper! Parece que te sobrará dinero.`;
      }
    }

    const suggestions = topCat ? [`¿Cuánto he gastado en ${topCat[0]}?`, 'Dame un consejo'] : ['Dime mi saldo', 'Dame un consejo'];

    return { text, newContext, suggestions };
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

    let resp = `Actualmente tienes **$${totalCuentas.toLocaleString('es-CO')}** disponibles en tus cuentas principales, y **$${totalAhorro.toLocaleString('es-CO')}** en tus ahorros o bolsillos.`;
    
    if (totalCuentas > 1000000 && totalAhorro < 100000) {
      resp += `\n\n🤖 **Mi Consejo:** Veo que tienes bastante dinero líquido en tus cuentas y poco en tus cajitas de ahorro. Te sugiero mover un porcentaje a una "Cajita" para separarlo de tu plata de uso diario. ¡Te ayudará a no gastártelo sin querer!`;
    }

    return { 
      text: resp, 
      newContext, 
      suggestions: totalCuentas > 1000000 && totalAhorro < 100000 ? ['¿Cómo crear una Cajita?', 'Dime mi resumen'] : ['Dime mi resumen', '¿Cuánto puedo gastar?']
    };
  }
  
  // 3.4 Exención Inteligente 4x1000 / GMF
  if (norm.match(/4x1000|cuatro por mil|gmf|impuesto/)) {
    const bajoMonto = cajitas.filter(c => c.esBajoMonto && c.archivedAt === null);
    
    let text = `Acá entre nos, el 4x1000 (o GMF) te quita $4 por cada $1.000 que muevas de tus cuentas financieras hacia afuera.\n\n`;
    
    if (bajoMonto.length > 0) {
      text += `¡Pero buenas noticias! Detecté que marcaste **${bajoMonto[0].nombre}** como Depósito de Bajo Monto. Recuerda que la DIAN te da una exención de hasta 65 UVT (aprox $3 millones de pesos al mes) en retiros de esa cuenta antes de cobrarte un solo peso de 4x1000.\n\nYo internamente llevo esa cuenta por ti. Si veo que te vas a pasar del límite en el mes, te lo advertiré.`;
    } else {
      text += `💡 **Un truco de oro:** Si tienes una cuenta como Nequi o Daviplata (Depósitos de Bajo Monto), ¡tienes hasta ~3 millones de pesos al mes libres de este impuesto sin importar cuál sea tu cuenta principal exenta!\n\nAsegúrate de ir a 'Configuración > Editar Cajita' y marcarla como 'Depósito de Bajo Monto' para que yo te calcule exactamente cuánto cupo te queda sin pagar impuestos.`;
    }

    return { 
      text, 
      newContext,
      suggestions: ['Dame un consejo', 'Resumen del mes']
    };
  }

  // 3.5. Presupuesto Diario Sugerido ("cuanto puedo gastar", "cuanto me queda")
  if (norm.includes('puedo gastar') || (norm.includes('cuanto') && norm.includes('me queda')) || norm.includes('presupuesto')) {
    const totalCuentas = cajitas
      .filter((c) => c.tipo === 'cuenta' && c.archivedAt === null)
      .reduce((sum, c) => sum + (cajitasBalances[c.id] || 0), 0);
      
    if (totalCuentas === 0) {
      return { text: "No tienes saldo en tus cuentas ahora mismo para calcular un presupuesto.", newContext };
    }

    const hoy = new Date();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    const diasRestantes = ultimoDia - hoy.getDate() + 1; // +1 to include today
    
    const diario = Math.floor(totalCuentas / diasRestantes);
    
    return { text: `Te quedan **${diasRestantes} días** para que acabe el mes y tienes **$${totalCuentas.toLocaleString('es-CO')}** en tus cuentas. \n\nSi quieres que esa plata te alcance hasta fin de mes, tu presupuesto sugerido es de **$${diario.toLocaleString('es-CO')} diarios**. ¡Intenta no pasarte de ahí!`, newContext };
  }

  // 3.6. Gastos Recurrentes / Suscripciones
  if (norm.includes('suscripciones') || norm.includes('gastos fijos') || norm.includes('pagos recurrentes')) {
    const counts: Record<string, { occurrences: number, amount: number, lastDate: string }> = {};
    
    // Agrupar por descripción exacta
    transacciones.filter(t => t.kind === 'gasto' && t.description.length > 3).forEach(t => {
      const d = t.description.trim().toLowerCase();
      if (!counts[d]) counts[d] = { occurrences: 0, amount: t.amountCop, lastDate: t.occurredOn };
      counts[d].occurrences += 1;
      // Actualizar a la cantidad más reciente
      if (t.occurredOn > counts[d].lastDate) {
        counts[d].amount = t.amountCop;
        counts[d].lastDate = t.occurredOn;
      }
    });

    const recurrentes = Object.entries(counts).filter(([_, v]) => v.occurrences >= 2).sort((a, b) => b[1].amount - a[1].amount);
    
    if (recurrentes.length === 0) {
      return { text: 'No he detectado suscripciones ni gastos fijos que se repitan en tu historial por ahora.', newContext };
    }

    const sumaRecurrente = recurrentes.reduce((acc, [_, v]) => acc + v.amount, 0);
    let text = `Detecté **${recurrentes.length} gastos recurrentes** en tu historial (suscripciones o pagos frecuentes). \n\nCalculo que esto te cuesta aproximadamente **$${sumaRecurrente.toLocaleString('es-CO')}** cada mes:\n`;
    
    recurrentes.slice(0, 5).forEach(([nombre, data]) => {
      text += `• **${nombre}**: $${data.amount.toLocaleString('es-CO')}\n`;
    });

    if (recurrentes.length > 5) text += `• ...y otros ${recurrentes.length - 5} gastos menores.\n`;
    
    return { 
      text, 
      newContext, 
      suggestions: ['Dame un consejo', 'Resumen del mes'] 
    };
  }

  // 3.7. Analítica Profunda / Anomaly Detection ("sorprendeme", "dato curioso", "algo raro")
  if (norm.match(/sorpren.*deme|dato curioso|raro|interesante|sorprendeme/)) {
    if (transacciones.length < 10) {
      return { text: 'Aún no tienes suficientes transacciones para que mi motor analítico encuentre patrones interesantes. ¡Registra más gastos!', newContext };
    }

    const gastos = transacciones.filter(t => t.kind === 'gasto');
    const amounts = gastos.map(t => t.amountCop);
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    
    const byDayOfWeek = [0,0,0,0,0,0,0]; // 0 = Sunday
    gastos.forEach(t => {
      const d = new Date(t.occurredOn);
      d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
      byDayOfWeek[d.getDay()] += t.amountCop;
    });

    const diasNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const maxDayIdx = byDayOfWeek.indexOf(Math.max(...byDayOfWeek));
    const dayName = diasNombres[maxDayIdx];

    const anomaly = gastos.find(t => t.amountCop > avg * 4); // Gastó 4x el promedio

    const descFreq: Record<string, number> = {};
    gastos.forEach(t => { descFreq[t.description] = (descFreq[t.description] || 0) + 1; });
    const sortedFreq = Object.entries(descFreq).sort((a, b) => b[1] - a[1]);
    const topFreq = sortedFreq[0];
    const top2Freq = sortedFreq[1];

    const insights = [];
    
    insights.push(`🗓️ **Tu Día Más Caro:** Históricamente, el día de la semana en el que más dinero gastas es el **${dayName}**. Intenta dejar la tarjeta en casa ese día la próxima semana para probarte a ti mismo.`);
    
    if (anomaly) {
      insights.push(`🚨 **Gasto Inusual:** Noté que el ${anomaly.occurredOn} gastaste **$${anomaly.amountCop.toLocaleString('es-CO')}** en "${anomaly.description}". Eso fue muchísimo más alto que tu promedio normal por compra ($${Math.round(avg).toLocaleString('es-CO')}). ¡Fue un golpe fuerte!`);
    }

    if (topFreq && topFreq[1] > 3) {
      insights.push(`🐜 **Frecuencia Adictiva:** Ojo acá, has pagado por "${topFreq[0]}" un total de **${topFreq[1]} veces**. ¡Ese es tu gasto hormiga más constante y silencioso!`);
    }
    
    if (top2Freq && top2Freq[1] > 2) {
      insights.push(`☕ **Otro Gasto Frecuente:** "${top2Freq[0]}" se repite mucho en tu historial (lo has pagado ${top2Freq[1]} veces). Si puedes recortarlo a la mitad, verás cómo crece tu ahorro.`);
    }

    const intros = [
      '¡Claro! Me sumergí en tus datos y encontré esto interesante:',
      'Mira este patrón oculto en tus finanzas:',
      'Analizando tu historial de gastos, hay algo que me llamó la atención:',
      'Aquí tienes un dato curioso sobre cómo manejas tu dinero:'
    ];

    const idx = (context.lastInsightIdx || 0) % insights.length;
    const selectedInsight = insights[idx];
    
    newContext.lastInsightIdx = idx + 1;

    return { 
      text: `${getRandom(intros)}\n\n${selectedInsight}`, 
      newContext,
      suggestions: ['Dame otro dato', 'Mis suscripciones', 'Dame un consejo']
    };
  }

  // 4. Analizar intención usando ParseTransaction (extraído a detectarMovimiento,
  // que es la misma puerta que usa AsesorView cuando responde el LLM).
  const isQuestion = norm.includes('cuanto') || norm.includes('cual') || norm.includes('?') || norm.includes('total') || norm.includes('dime');

  const deteccion = detectarMovimiento(texto, transacciones, cajitas, categorias, lexico, context);
  const intent = deteccion.intent;
  Object.assign(newContext, deteccion.newContext);

  if (deteccion.propuesta) {
    return { ...deteccion.propuesta, newContext };
  }

  // 4.3 Missing amount fallback
  if (!isQuestion && !intent.amount && (norm.includes('gaste') || norm.includes('compre') || norm.includes('pague') || norm.includes('costo') || norm.includes('cobraron') || norm.includes('me pagaron') || norm.match(/fui a (comer|cenar|comprar|mercar)/))) {
    return {
      text: `¡Entiendo! Pero me faltó el dato más importante: ¿cuánto fue el monto exacto? Dímelo y lo registro de inmediato en ${intent.category !== 'otros' ? intent.category : 'tus cuentas'}.`,
      newContext
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

    // `intent.description` es lo que le sobró al parser después de sacar el
    // monto y la fecha — para "cuánto gasté ayer" eso es literalmente "Cuanto
    // gaste", puro relleno de la pregunta. La lista de descarte comparaba la
    // FRASE completa contra palabras sueltas, así que "cuanto gaste" nunca
    // coincidía con nada y se trataba como si el usuario hubiera nombrado algo
    // específico que buscar — filtrando todo el historial a cero, porque
    // ningún movimiento real tiene "cuanto gaste" en su descripción. Ahora se
    // descarta si CADA palabra de lo que quedó es puro relleno de pregunta.
    const RELLENO_PREGUNTA = new Set(['este', 'esta', 'el', 'la', 'de', 'en', 'mes', 'dia', 'dias', 'ayer', 'hoy', 'cuanto', 'cuanta', 'gastado', 'gaste', 'gasto', 'total', 'año', 'anio', 'pasado', 'semana', 'busca', 'gastos']);
    const isMeaningfulDescription = Boolean(
      intent.description &&
      intent.description.length > 2 &&
      !normalizarNombre(intent.description).split(' ').every((palabra) => RELLENO_PREGUNTA.has(palabra)),
    );

    if (intent.signals.categorySource !== 'default' || isMeaningfulDescription || fuzzyCat) {
      const catFinal = intent.signals.categorySource !== 'default' ? intent.category : (fuzzyCat || intent.category);
      filtered = filtered.filter(t => 
        t.category === catFinal || 
        (isMeaningfulDescription && (
          normalizarNombre(t.description).includes(normalizarNombre(intent.description)) ||
          (t.rawTranscript && normalizarNombre(t.rawTranscript).includes(normalizarNombre(intent.description)))
        )) ||
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
    
    const concepto = asunto === 'total' ? 'general' : `**${asunto}**`;

    if (filtered.length === 0) {
      const varsCero = tipo === 'ingreso' ? VARIANCES.cero_ingreso : VARIANCES.cero_gasto;
      return { text: getRandom(varsCero).replace('X', total.toLocaleString('es-CO')).replace('Y', concepto).replace('Z', fechaStr), newContext };
    }
    
    // Top contact/comment within this specific search!
    const porContacto: Record<string, number> = {};
    filtered.forEach(t => {
      const desc = t.description.trim() || 'Sin descripción';
      porContacto[desc] = (porContacto[desc] || 0) + t.amountCop;
    });
    const topContacto = Object.entries(porContacto).sort((a, b) => b[1] - a[1])[0];
    
    let drilldown = '';
    if (topContacto && topContacto[1] > 0 && topContacto[0] !== 'Sin descripción' && !isMeaningfulDescription) {
      drilldown = `\n\n🔍 **Dato curioso:** De esos $${total.toLocaleString('es-CO')}, la mayor parte se fue en **"${topContacto[0]}"** ($${topContacto[1].toLocaleString('es-CO')}).`;
    }

    // Comparativa mes pasado (Magic AI feel)
    let tendencia = '';
    if (tipo === 'gasto' && filterDate === null && !norm.includes('año')) {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lmKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
      
      const lastMonthTotal = transacciones
        .filter(t => t.occurredOn.startsWith(lmKey) && t.kind === 'gasto' && (asunto === 'total' || t.category === asunto || (isMeaningfulDescription && normalizarNombre(t.description).includes(normalizarNombre(intent.description)))))
        .reduce((sum, t) => sum + t.amountCop, 0);
        
      if (lastMonthTotal > 0) {
        const diff = total - lastMonthTotal;
        tendencia = diff > 0 
          ? `(Por cierto, van ⚠️ **$${Math.abs(diff).toLocaleString('es-CO')} más** que el mes pasado a esta misma fecha).`
          : `(Lo bueno es que van ✅ **$${Math.abs(diff).toLocaleString('es-CO')} menos** que el mes pasado a esta fecha).`;
      }
    }

    const varsFinal = tipo === 'ingreso' ? VARIANCES.ingreso : VARIANCES.gasto;
    return { 
      text: getRandom(varsFinal).replace('X', total.toLocaleString('es-CO')).replace('Y', concepto).replace('Z', fechaStr) + ` (Eso fue en ${filtered.length} transacciones). ${tendencia}` + drilldown, 
      newContext,
      suggestions: topContacto && topContacto[0] !== 'Sin descripción' ? [`¿Y el mes pasado?`, `¿Cuánto puedo gastar?`] : ['Dime mi resumen', 'Dame un consejo']
    };
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
        'Puedo hacer muchas cosas: preguntarme cuánto gastaste en algo, pedirme un resumen del mes, comparar tus gastos con el mes pasado, pedirme tu saldo o incluso decirme directamente "ayer gasté 20 lucas en cine" para que lo anote por ti.',
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
      regex: /y si no me alcanza/i,
      responses: [
        '¡Tranquilo! Ese es el miedo de todos. Si sientes que no te va a alcanzar, lo mejor es frenar cualquier "gasto hormiga" desde ya. ¿Quieres que miremos en qué estás gastando más este mes para cortarlo a tiempo?',
        'Si no te alcanza, tenemos que entrar en "modo supervivencia". Cero domicilios, cero salidas innecesarias. ¿Te parece si hacemos un presupuesto diario con la plata que te queda?'
      ]
    },
    {
      regex: /no me rinde|no me alcanza|se me va( la plata| el dinero)/i,
      responses: [
        'Es una sensación horrible, lo sé. Generalmente la plata "se va" sin darnos cuenta en compras chiquitas. Intenta registrar *absolutamente todo* esta semana, hasta un chicle, y te prometo que encontraremos el hueco.',
        'Suele pasar cuando no tenemos un presupuesto fijo. ¡Pero para eso estoy aquí! Hagamos el ejercicio: ¿ya registraste todos los gastos de hoy?'
      ]
    },
    {
      regex: /que (hago|me recomiendas|deberia hacer)/i,
      responses: [
        'Mi primera recomendación es que siempre sepas cuánto tienes. Pídeme un "resumen" a menudo. Si ves que el balance está en rojo, corta gastos. Si está en verde, ¡ahorra la diferencia!',
        'Haz un presupuesto a principio de mes y no te salgas de él. Y si sobra alguito, mételo directo a una Cajita para que no te pique la mano por gastarlo.'
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
      regex: /estoy (quebrado|pobre|sin plata|arruinado|endeudado)/i,
      responses: [
        '¡Tranquilo! Las malas rachas pasan. Lo importante es empezar a registrar cada peso para saber por dónde se está fugando el dinero. Si quieres, dime un resumen de lo que tienes ahora mismo en el bolsillo y empezamos desde ahí.',
        'A todos nos pasa. El primer paso para mejorar es medir. Intenta no gastar más de lo necesario esta semana y revisemos tu resumen en unos días.'
      ]
    },
    {
      regex: /(mierda|puta|joder|carajo|maldita sea|puto|hijueputa|hpta)/i,
      responses: [
        '¡Uy, respira profundo! Sé que los números a veces estresan y dan ganas de tirar todo por la ventana, pero todo tiene arreglo si nos organizamos. ¿Qué pasó? ¿Hiciste un gasto que no debías?',
        '¡Calma, calma! Las finanzas pueden ser un dolor de cabeza. Tomemos un vaso de agua y revisemos los números con cabeza fría.'
      ]
    },
    {
      regex: /(consejo|tip|recomendacion|recomiendas)/i,
      responses: [
        '¡Claro! Mi mejor consejo es la regla del 50/30/20: destina 50% de tus ingresos a necesidades básicas, 30% a gustos y un 20% inténtalo ahorrar o invertir. Si quieres, pregúntame por tu resumen y miramos cómo vas.',
        'Te doy un tip: revisa siempre los "gastos hormiga" (esos cafés o snacks diarios que parecen poco pero suman mucho a fin de mes). Si me dices "¿cuánto gasté en café?", podemos investigarlo juntos.',
        'La mejor recomendación que te puedo dar es que mantengas tus ahorros separados de tu cuenta principal (por ejemplo, en una Cajita). Así tu cerebro cree que tienes menos dinero disponible y evitarás gastar por impulso.'
      ]
    },
    {
      regex: /robo|estafa|atraco|carisimo|muy caro/i,
      responses: [
        '¡Uy, qué dolor de bolsillo! A veces toca aprender a la mala. ¡Registremos esto y tratemos de recuperarnos ahorrando en otras cosas esta semana!',
        'Eso suena terrible. 🤕 Cuando pagamos más de la cuenta da mucha rabia, pero míralo como una alerta para no volver a caer. ¿Lo anotamos de todas formas?'
      ]
    },
    {
      regex: /ganga|barato|promocion|descuento|ofertazo/i,
      responses: [
        '¡Excelente! Aprovechar buenas ofertas es la base del ahorro inteligente. Ojalá todas las compras fueran así. ¡Dime el monto y lo anoto con gusto!',
        '¡Eso sí que es una victoria financiera! 🎉 Cada peso que te ahorras en una promoción es un peso que puedes mandar a tu Cajita de ahorros.'
      ]
    },
    {
      regex: /cdt|invertir|inversion|acciones|bitcoin|cripto|bolsa/i,
      responses: [
        '¡Me encanta que pienses en el futuro! Si vas a invertir en algo seguro, un CDT es ideal hoy en día porque las tasas suelen estar altas. Si buscas cripto o acciones, hazlo solo con dinero que "estés dispuesto a perder". Recuerda diversificar.',
        'Regla de oro: nunca inviertas en negocios que no entiendes. Si quieres empezar suave, los depósitos a plazo fijo (CDT) de los bancos son buena opción. Si quieres más riesgo, busca ETFs en la bolsa. ¡Pero siempre con cabeza fría!'
      ]
    },
    {
      regex: /cuanto me falta para|meta de ahorro|como va mi meta/i,
      responses: [
        'Para revisar el progreso de tus metas, ve a la sección "Cuentas" y mira el progreso de tu "Cajita" asignada. Si le pones una meta clara y le asignas un monto total, la app te mostrará exactamente qué porcentaje llevas. ¡Sigue así!',
        '¡Vas por buen camino! Cada vez que guardas dinero en una Cajita te acercas a esa meta. Intenta establecer transferencias automáticas para que el ahorro crezca sin que te des cuenta.'
      ]
    },
    {
      regex: /(como|puedo) (borrar|eliminar|editar|modificar|corregir|cancelar|deshacer)|me equivoque/i,
      responses: [
        '¡No te preocupes! Si te equivocaste con un gasto, simplemente ve a la pestaña "Movimientos" en la barra inferior. Ahí puedes tocar cualquier transacción para editarla o deslizarla hacia la izquierda para eliminarla.',
        'Es muy fácil corregir errores: ve a "Movimientos", busca el registro y tócalo para cambiar el monto o la categoría. ¡O elimínalo si fue una prueba!'
      ]
    },
    {
      regex: /como (ahorrar|ahorro)|quiero ahorrar|empezar a ahorrar/i,
      responses: [
        '¡Esa es la actitud! La mejor forma de ahorrar aquí es crear una "Cajita". Ve a la pestaña "Cuentas", crea una Cajita y muévele dinero. Así separas tu ahorro de tu plata de uso diario y evitas gastarlo.',
        'Te recomiendo la técnica de "pagarte a ti primero". Apenas recibas tu sueldo, manda el 10% a una Cajita de ahorro en la app. ¡Ojos que no ven, corazón que no gasta!'
      ]
    },
    {
      regex: /prestamo|deuda|me prestaron|le preste/i,
      responses: [
        'Las deudas pueden ser engañosas. Si prestaste plata, regístralo como un Gasto en la categoría "Préstamos". Cuando te paguen, lo registras como un Ingreso en esa misma categoría. Así tu balance se mantendrá exacto.',
        'Para llevar el control de préstamos, te sugiero crear una categoría personalizada llamada "Deudas" o "Préstamos" y registrar ahí los movimientos. ¡Que no se te olvide cobrar!'
      ]
    }
  ];

  for (const rule of chitchatRules) {
    if (rule.regex.test(norm)) {
      return { 
        text: getRandom(rule.responses), 
        newContext,
        suggestions: ['Dime mi resumen', '¿Cuánto puedo gastar?']
      };
    }
  }

  // Fallback final más humano
  return { 
    text: getRandom([
      'Ups, me perdí un poco con eso último. 😅 Mi fuerte son los números, sumas y fechas. ¿Por qué no me preguntas por tu saldo, tu resumen del mes o directamente me dictas un gasto?',
      'Ay, me corchaste. Sigo siendo una IA aprendiendo a conversar. Si me das instrucciones más directas como "Cuánto gasté en Rappi" o "Resumen de mis cuentas", ¡te ayudaré de inmediato!',
      'Mmm, creo que no te copié bien. Recuerda que soy mejor para las cuentas claras. Prueba preguntarme montos, resúmenes o dime qué gastaste hoy para registrarlo.'
    ]),
    newContext,
    suggestions: ['¿Cuánto he gastado?', 'Dame un resumen']
  };
}
