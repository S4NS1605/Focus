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

  cuentas: {
    total: 'Total en tus cuentas',
    vacio: 'Aún no tienes cuentas.',
    vacioHint: 'Crea una para llevarle el rastro a lo que vas ahorrando.',
    nueva: 'Agregar cuenta bancaria',
    nombrePlaceholder: 'Ej: Nequi, Bancolombia',
    saldoInicial: '¿Cuánto tienes en esta cuenta?',
    cuantoTienes: '¿Cuánto tienes ahora en esta cuenta?',
    cuantoTienesHint:
      'Escribe el saldo que ves en tu banco. La app calcula sola la diferencia y la deja anotada.',
    historial: 'Ajustes de saldo',
    sinMovimientos: 'Sin ajustes todavía.',
    eliminar: 'Eliminar cuenta',
    confirmarEliminar:
      'Se elimina la cuenta y su historial de saldos. Tus movimientos registrados no se tocan.',
  },

  cajitas: {
    titulo: 'Cajitas',
    total: 'Total guardado',
    enCuentas: 'En cuentas',
    enCajitas: 'En cajitas',
    vacio: 'Aún no tienes cajitas.',
    vacioHint: 'Agrega tu banco y dile cuánto tienes: la app lleva el resto.',
    nueva: 'Nueva cajita',
    grupoCuentas: 'Cuentas bancarias',
    grupoCajitas: 'Cajitas de ahorro',
    nombre: 'Nombre',
    nombrePlaceholder: 'Ej: Vacaciones',
    saldoInicial: '¿Cuánto tienes ahí ahora?',
    saldoInicialHint: 'Escribe el saldo que ves en tu app. Puedes dejarlo en 0 y agregarlo después.',
    metaOpcional: 'Meta a la que quieres llegar (opcional)',
    tasaOpcional: 'Rendimiento (opcional)',
    tasaHint:
      'La tasa efectiva anual que paga la cajita. La ves en tu app del banco — en Nu está en la cajita misma.',
    rendimientoTitulo: 'Rendimiento estimado',
    rendimientoAcumulado: 'acumulado en',
    rendimientoDias: 'días',
    rendimientoDiario: 'al día',
    rendimientoAnual: 'al año si no la mueves',
    rendimientoNota:
      'Es una estimación calculada con tu tasa y tus movimientos, no lo que el banco ya te pagó. Cuando te lo abonen, regístralo como Rendimiento.',
    crearCuenta: 'Crear cuenta',
    crearCajita: 'Crear cajita',
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
