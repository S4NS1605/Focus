import { parseTransaction } from './parseTransaction';
import type { Transaction } from '../types';
import type { Cajita } from '../data/modelos';
import { normalizarNombre } from './contactos';

export function responderAsesor(
  texto: string,
  transacciones: readonly Transaction[],
  cajitas: readonly Cajita[],
  cajitasBalances: Record<string, number>
): string {
  const norm = normalizarNombre(texto);

  // 1. Saludos
  if (norm === 'hola' || norm === 'hola asesor' || norm === 'buenas' || norm === 'buenos dias') {
    return '¡Hola! Qué gusto saludarte. Estoy aquí para analizar tus movimientos y responder preguntas sobre tu dinero. ¿De qué quieres que hablemos?';
  }
  if (norm.includes('quien eres') || norm.includes('que haces')) {
    return 'Soy tu Asesor Financiero Local. Mi trabajo es leer tus transacciones (sin mandarlas a internet) y responder preguntas como "¿Cuánto gasté en Rappi este mes?" o "¿En qué se me fue la plata?".';
  }

  // 2. Consulta de Saldos (Cuentas/Cajitas)
  if (norm.includes('cuanto') && (norm.includes('tengo') || norm.includes('saldo') || norm.includes('dinero') || norm.includes('plata')) && !norm.includes('gastado') && !norm.includes('gaste')) {
    const totalCuentas = cajitas
      .filter((c) => c.tipo === 'cuenta' && c.archivedAt === null)
      .reduce((sum, c) => sum + (cajitasBalances[c.id] || 0), 0);
    const totalAhorro = cajitas
      .filter((c) => c.tipo === 'cajita' && c.archivedAt === null)
      .reduce((sum, c) => sum + (cajitasBalances[c.id] || 0), 0);
    
    // Búsqueda específica de una cuenta (ej: "cuanta plata tengo en nequi")
    const cuentaEspecifica = cajitas.find(c => norm.includes(normalizarNombre(c.nombre)));
    if (cuentaEspecifica) {
      const bal = cajitasBalances[cuentaEspecifica.id] || 0;
      return `En tu cuenta **${cuentaEspecifica.nombre}** tienes un saldo de $${bal.toLocaleString('es-CO')}.`;
    }

    return `Actualmente tienes **$${totalCuentas.toLocaleString('es-CO')}** disponibles en tus cuentas, y **$${totalAhorro.toLocaleString('es-CO')}** en tus ahorros/bolsillos.`;
  }

  // 3. Analizar la intención con el Parser Local
  const cuentasParaElegir = cajitas
    .filter((c) => c.archivedAt === null && c.tipo === 'cuenta')
    .map((c) => ({ id: c.id, nombre: c.nombre, esBajoMonto: false }));

  const intent = parseTransaction(texto, cuentasParaElegir, [], { categoriaDe: () => null, tamano: 0 }, transacciones);

  // 4. Preguntas de Gastos ("Cuanto he gastado en X")
  if (norm.includes('cuanto') || norm.includes('gasto') || norm.includes('gaste') || norm.includes('total') || norm.includes('gastos')) {
    
    let filtered = transacciones;

    // Filter by date if the parser detected one ("ayer", "hace 3 dias")
    if (intent.dateOverride) {
      filtered = filtered.filter(t => t.occurredOn === intent.dateOverride);
    } else {
      // Por defecto, si no hay fecha, miramos el mes actual
      const today = new Date();
      const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      filtered = filtered.filter(t => t.occurredOn.startsWith(currentMonth));
    }

    // Si detectó una categoría o comercio de la pregunta
    let asunto = 'total';
    if (intent.signals.categorySource !== 'default' || norm.includes(intent.description.toLowerCase())) {
      filtered = filtered.filter(t => 
        t.category === intent.category || 
        normalizarNombre(t.description).includes(normalizarNombre(intent.description)) ||
        normalizarNombre(t.description).includes(normalizarNombre(texto.replace('cuanto', '').replace('he', '').replace('gastado', '').replace('en', '')))
      );
      asunto = intent.category;
    }

    // Filtrar solo los egresos para este tipo de preguntas, a menos que hablen de ingresos
    const tipo = (norm.includes('ingreso') || norm.includes('gane') || norm.includes('recibi')) ? 'ingreso' : 'gasto';
    filtered = filtered.filter(t => t.kind === tipo);

    const total = filtered.reduce((acc, t) => acc + t.amountCop, 0);

    let fechaStr = intent.dateOverride ? `el ${intent.dateOverride}` : 'este mes';
    if (norm.includes('historico') || norm.includes('siempre') || norm.includes('total')) {
      // Remove date filter if they asked for total history
      // (This requires a slightly different logic, but kept simple for now)
    }

    if (filtered.length === 0) {
      return `No encontré ningún ${tipo} registrado de eso ${fechaStr}.`;
    }

    const concepto = asunto === 'total' ? 'en general' : `en **${asunto}**`;
    return `Has registrado **$${total.toLocaleString('es-CO')}** ${concepto} ${fechaStr} (en ${filtered.length} transacciones).`;
  }

  // 5. Consejos (Fallback genérico pero útil)
  if (norm.includes('consejo') || norm.includes('analisis') || norm.includes('ayuda')) {
    return 'Mi mejor consejo por ahora es: revisa siempre tus suscripciones y "gastos hormiga" (comida, antojos). Normalmente ahí es donde el presupuesto se descuadra sin que nos demos cuenta. ¡Si quieres saber cuánto llevas en antojos este mes, pregúntame!';
  }

  return 'No estoy 100% seguro de entender la pregunta. Recuerda que puedes preguntarme cosas directas como: "¿Cuánto he gastado en Rappi este mes?" o "¿Cuánto saldo tengo en Nequi?".';
}
