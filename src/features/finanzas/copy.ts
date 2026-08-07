// Spanish-only, deliberately NOT wired into LanguageContext: that interface is
// a Record<Language, Translations>, so adding a key here would force writing
// English copy for a private tool and make the shared type a chokepoint that can
// break the portfolio's type-check.
export const COPY = {
  appName: 'Finanzas',

  balance: {
    balance: 'Balance',
    ingresos: 'Ingresos',
    gastos: 'Gastos',
  },

  input: {
    placeholder: 'Ej: gasté 20 mil en el almuerzo',
    submit: 'Registrar',
    listening: 'Escuchando…',
    speak: 'Dictar',
    stop: 'Detener',
    keyboardHint: 'Toca el campo y usa la tecla del micrófono del teclado para dictar.',
    blocked: 'El dictado de un toque no funciona con la app instalada. Usa la tecla del micrófono del teclado.',
    offline: 'El dictado de un toque necesita internet. La tecla del micrófono del teclado funciona sin conexión.',
  },

  confirm: {
    title: 'Confirmar',
    titleEditar: 'Editar movimiento',
    review: 'Revisa lo resaltado',
    amount: 'Monto',
    kind: 'Tipo',
    gasto: 'Gasto',
    ingreso: 'Ingreso',
    category: 'Categoría',
    description: 'Descripción',
    heard: 'Escuché',
    save: 'Guardar',
    saveEditar: 'Guardar cambios',
    cancel: 'Cancelar',
    amountMissing: 'No entendí el monto',
  },

  list: {
    empty: 'Aún no hay movimientos.',
    emptyHint: 'Dicta o escribe tu primer gasto arriba.',
    delete: 'Eliminar',
    edit: 'Editar',
  },

  almacen: {
    cargando: 'Abriendo tus datos…',
    sinPersistencia:
      'Este navegador no deja guardar datos, así que lo que registres se pierde al cerrar. Suele pasar en ventanas de incógnito.',
    descartar: 'Entendido',
  },

  cajitas: {
    titulo: 'Cajitas',
    total: 'Total guardado',
    vacio: 'Aún no tienes cajitas.',
    vacioHint: 'Crea una para llevarle el rastro a lo que vas ahorrando.',
    nueva: 'Nueva cajita',
    nombre: 'Nombre',
    nombrePlaceholder: 'Ej: Vacaciones',
    metaOpcional: 'Meta de la cajita (opcional)',
    crear: 'Crear cajita',
    saldo: 'Saldo',
    actualizarSaldo: 'Actualizar saldo',
    cuantoTienes: '¿Cuánto tienes ahora en esta cajita?',
    cuantoTienesHint:
      'Escribe el saldo real y la app calcula sola la diferencia, dejando el historial cuadrado.',
    depositar: 'Depositar',
    retirar: 'Retirar',
    rendimiento: 'Rendimiento',
    historial: 'Movimientos de la cajita',
    sinMovimientos: 'Sin movimientos todavía.',
    eliminar: 'Eliminar cajita',
    confirmarEliminar:
      'Se elimina la cajita y todo su historial. Las metas enlazadas se conservan, pero pierden el enlace.',
  },

  metas: {
    titulo: 'Metas',
    vacio: 'Aún no tienes metas.',
    vacioHint: 'Ponte un objetivo y la app te dice si el ritmo te alcanza.',
    nueva: 'Nueva meta',
    nombre: 'Nombre',
    nombrePlaceholder: 'Ej: Viaje a Cartagena',
    objetivo: 'Objetivo',
    fecha: 'Fecha límite (opcional)',
    enlazar: 'Seguir el saldo de una cajita',
    sinEnlace: 'Llevarla a mano',
    crear: 'Crear meta',
    falta: 'Te falta',
    lograda: '¡Meta lograda!',
    ritmo: 'Necesitas ahorrar',
    porMes: 'al mes',
    vencida: 'La fecha ya pasó',
    diasRestantes: 'días restantes',
    eliminar: 'Eliminar meta',
    ahorrado: 'Ahorrado',
  },

  tendencias: {
    titulo: 'Tendencias',
    ultimosMeses: 'Últimos 6 meses',
    promedio: 'Promedio mensual',
    promedioNota: 'Solo se cuentan los meses con movimientos registrados.',
    comparativo: 'Contra el mes pasado',
    subio: 'subió',
    bajo: 'bajó',
    nuevo: 'nuevo este mes',
    desaparecio: 'ya no aparece',
    sinDatos: 'Aún no hay suficientes meses para comparar.',
    sinDatosHint: 'Registra movimientos en al menos dos meses distintos.',
    balancePositivo: 'meses en verde',
    balanceNegativo: 'meses en rojo',
  },
} as const;
