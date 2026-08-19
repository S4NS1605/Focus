import { useCallback, useEffect, useState } from 'react';
import { UVT_POR_DEFECTO } from '../lib/gmf';
import type { RegimenGmf, ValorUvt } from '../lib/gmf';

/**
 * Display preferences, kept beside the theme rather than in the ledger.
 *
 * These live in localStorage, per device, for the same reason `useTema` does:
 * they say how this screen should look, not what is true about the money. A
 * phone left on the kitchen table and a laptop at work can reasonably want
 * different answers, and nothing here needs to survive a reinstall.
 */
const CLAVE_AHORRO = 'finanzas:resumen:ahorro';
const CLAVE_NOMBRE = 'finanzas:onboarding:nombre';
const CLAVE_ONBOARDING = 'finanzas:onboarding:terminado';
const CLAVE_UVT = 'finanzas:gmf:uvt';
const CLAVE_CUENTAS_GMF = 'finanzas:gmf:cuentas';
const CLAVE_REGIMEN = 'finanzas:gmf:regimen';
const CLAVE_CUENTA_EXENTA = 'finanzas:gmf:cuenta-exenta';

const leerBooleano = (clave: string, porDefecto: boolean): boolean => {
  if (typeof window === 'undefined') return porDefecto;
  try {
    const guardado = localStorage.getItem(clave);
    if (guardado === 'si') return true;
    if (guardado === 'no') return false;
  } catch {
    // Safari in private mode throws rather than returning null.
  }
  return porDefecto;
};

const guardarBooleano = (clave: string, valor: boolean): void => {
  try {
    localStorage.setItem(clave, valor ? 'si' : 'no');
    guardarEnSupabase(clave, valor);
  } catch {
    // The switch still works, it just will not be remembered.
  }
};

export const sincronizarDesdeSupabase = (metadata: Record<string, any>) => {
  if (typeof window === 'undefined') return;
  let cambio = false;

  const setIf = (k: string, v: string | null) => {
    if (v === null) {
      if (localStorage.getItem(k) !== null) {
        localStorage.removeItem(k);
        cambio = true;
      }
    } else {
      if (localStorage.getItem(k) !== v) {
        localStorage.setItem(k, v);
        cambio = true;
      }
    }
  };

  if (metadata[CLAVE_AHORRO] !== undefined)
    setIf(CLAVE_AHORRO, metadata[CLAVE_AHORRO] ? 'si' : 'no');
  if (metadata[CLAVE_NOMBRE] !== undefined) setIf(CLAVE_NOMBRE, metadata[CLAVE_NOMBRE]);
  // Nunca se baja a 'no' desde la nube: si en cualquier dispositivo ya se
  // terminó la bienvenida, se terminó en todos.
  if (metadata[CLAVE_ONBOARDING]) setIf(CLAVE_ONBOARDING, 'si');
  if (metadata[CLAVE_UVT] !== undefined) setIf(CLAVE_UVT, JSON.stringify(metadata[CLAVE_UVT]));
  if (metadata[CLAVE_CUENTAS_GMF] !== undefined)
    setIf(CLAVE_CUENTAS_GMF, JSON.stringify(metadata[CLAVE_CUENTAS_GMF]));
  if (metadata[CLAVE_REGIMEN] !== undefined) setIf(CLAVE_REGIMEN, metadata[CLAVE_REGIMEN]);
  if (metadata[CLAVE_CUENTA_EXENTA] !== undefined)
    setIf(CLAVE_CUENTA_EXENTA, metadata[CLAVE_CUENTA_EXENTA]);

  // Si hubo algún cambio desde la nube, forzamos que todos los hooks locales se recarguen.
  if (cambio) {
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
  }
};

const guardarEnSupabase = async (clave: string, valor: any) => {
  if (typeof window === 'undefined') return;
  import('./supabase').then(({ obtenerSupabase }) => {
    const supabase = obtenerSupabase();
    if (supabase) {
      supabase.auth.updateUser({ data: { [clave]: valor } }).catch(() => {});
    }
  });
};

/**
 * Whether savings count toward the summary.
 *
 * On by default: the summary is meant to answer "how much do I have", and
 * leaving savings out of that by default would understate it for everyone who
 * never finds this switch.
 */
export const useMostrarAhorro = () => {
  const [mostrarAhorro, setEstado] = useState(() => leerBooleano(CLAVE_AHORRO, true));

  const setMostrarAhorro = useCallback((valor: boolean) => {
    setEstado(valor);
    guardarBooleano(CLAVE_AHORRO, valor);
  }, []);

  // `storage` fires in the OTHER tabs, never the one that wrote. Without it two
  // open tabs drift apart and disagree about the same total until one reloads —
  // and one of them is showing a figure nobody chose.
  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      if (e.key !== null && e.key !== CLAVE_AHORRO) return;
      setEstado(leerBooleano(CLAVE_AHORRO, true));
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  return { mostrarAhorro, setMostrarAhorro };
};

/**
 * Si la persona ya pasó por la bienvenida, y cómo se llama.
 *
 * Esto tiene que guardarse de verdad, y aquí está el porqué: antes la
 * bienvenida se decidía con `transacciones.length === 0`. O sea que se calculaba
 * sola a partir de los datos, y eso tenía dos efectos raros:
 *
 *   - guardabas UN movimiento y la bienvenida desaparecía, aunque no hubieras
 *     puesto ni un saldo real ni una categoría;
 *   - borrabas ese movimiento y la bienvenida VOLVÍA, como si fueras nuevo otra
 *     vez después de llevar meses usando la app.
 *
 * `terminado` se queda pegado: una vez está en verdadero, no vuelve a falso
 * nunca, pase lo que pase con los datos. Haber pasado por la bienvenida es un
 * hecho sobre la persona, no sobre su plata.
 */
export const useOnboarding = () => {
  const [terminado, setEstado] = useState(() => leerBooleano(CLAVE_ONBOARDING, false));
  const [nombre, setEstadoNombre] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return localStorage.getItem(CLAVE_NOMBRE) ?? '';
    } catch {
      return '';
    }
  });

  const guardarNombre = useCallback((valor: string) => {
    setEstadoNombre(valor);
    try {
      localStorage.setItem(CLAVE_NOMBRE, valor);
      guardarEnSupabase(CLAVE_NOMBRE, valor);
    } catch {
      // Sigue funcionando, solo que no se acuerda del nombre.
    }
  }, []);

  const terminar = useCallback(() => {
    setEstado(true);
    guardarBooleano(CLAVE_ONBOARDING, true);
  }, []);

  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      if (e.key !== null && e.key !== CLAVE_ONBOARDING && e.key !== CLAVE_NOMBRE) return;
      setEstado(leerBooleano(CLAVE_ONBOARDING, false));
      try {
        setEstadoNombre(localStorage.getItem(CLAVE_NOMBRE) ?? '');
      } catch {
        // Nada que hacer.
      }
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  return { terminado, nombre, guardarNombre, terminar };
};

/**
 * Ajustes del 4x1000.
 *
 * Viven aquí y no en el libro por dos razones distintas. La UVT es un dato
 * público que cambia cada año por resolución de la DIAN — no es un hecho sobre
 * la plata del usuario, es una constante del país que él puede corregir. Y qué
 * cuentas están en una entidad financiera es una anotación sobre la realidad,
 * no un movimiento: cambiarla no reescribe nada de lo ya registrado.
 */
export const useAjustesGmf = () => {
  const [uvt, setEstadoUvt] = useState<ValorUvt>(() => leerUvt());
  const [cuentasGmf, setEstadoCuentas] = useState<string[]>(() => leerLista(CLAVE_CUENTAS_GMF));
  const [regimen, setEstadoRegimen] = useState<RegimenGmf>(() => leerRegimen());
  const [cuentaExentaId, setEstadoExenta] = useState<string | null>(() =>
    leerTexto(CLAVE_CUENTA_EXENTA),
  );

  const setUvt = useCallback((valor: ValorUvt) => {
    setEstadoUvt(valor);
    try {
      localStorage.setItem(CLAVE_UVT, JSON.stringify(valor));
      guardarEnSupabase(CLAVE_UVT, valor);
    } catch {
      // El cambio funciona igual; solo no se recordará.
    }
  }, []);

  const setCuentasGmf = useCallback((ids: readonly string[]) => {
    const lista = [...new Set(ids)];
    setEstadoCuentas(lista);
    try {
      localStorage.setItem(CLAVE_CUENTAS_GMF, JSON.stringify(lista));
      guardarEnSupabase(CLAVE_CUENTAS_GMF, lista);
    } catch {
      // Igual que arriba.
    }
  }, []);

  const setRegimen = useCallback((valor: RegimenGmf) => {
    setEstadoRegimen(valor);
    try {
      localStorage.setItem(CLAVE_REGIMEN, valor);
      guardarEnSupabase(CLAVE_REGIMEN, valor);
    } catch {
      // Igual.
    }
  }, []);

  const setCuentaExentaId = useCallback((id: string | null) => {
    setEstadoExenta(id);
    try {
      if (id === null) {
        localStorage.removeItem(CLAVE_CUENTA_EXENTA);
        guardarEnSupabase(CLAVE_CUENTA_EXENTA, null);
      } else {
        localStorage.setItem(CLAVE_CUENTA_EXENTA, id);
        guardarEnSupabase(CLAVE_CUENTA_EXENTA, id);
      }
    } catch {
      // Igual.
    }
  }, []);

  // `storage` fires in the OTHER tabs, so multiple tabs keep in sync when the user changes a preference.
  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      // When synced from Supabase, key is passed as null to force a full re-read.
      if (e.key === null || e.key === CLAVE_UVT) setEstadoUvt(leerUvt());
      if (e.key === null || e.key === CLAVE_CUENTAS_GMF)
        setEstadoCuentas(leerLista(CLAVE_CUENTAS_GMF));
      if (e.key === null || e.key === CLAVE_REGIMEN) setEstadoRegimen(leerRegimen());
      if (e.key === null || e.key === CLAVE_CUENTA_EXENTA)
        setEstadoExenta(leerTexto(CLAVE_CUENTA_EXENTA));
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, []);

  return {
    uvt,
    setUvt,
    cuentasGmf,
    setCuentasGmf,
    regimen,
    setRegimen,
    cuentaExentaId,
    setCuentaExentaId,
  };
};

const leerRegimen = (): RegimenGmf => {
  if (typeof window === 'undefined') return 'distribuido';
  try {
    const v = localStorage.getItem(CLAVE_REGIMEN);
    if (v === 'marcada' || v === 'distribuido') return v;
  } catch {
    // Igual.
  }
  // Por defecto el vigente desde el 13 de diciembre de 2024.
  return 'distribuido';
};

const leerTexto = (clave: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};

const leerUvt = (): ValorUvt => {
  if (typeof window === 'undefined') return UVT_POR_DEFECTO;
  try {
    const crudo = localStorage.getItem(CLAVE_UVT);
    if (crudo) {
      const leido = JSON.parse(crudo) as Partial<ValorUvt>;
      // Un valor guardado a mano puede venir roto. Se valida antes de usarlo
      // porque con esto se calcula un tope en pesos.
      if (
        typeof leido.anio === 'number' &&
        typeof leido.pesos === 'number' &&
        leido.pesos > 0 &&
        Number.isFinite(leido.pesos)
      ) {
        return { anio: leido.anio, pesos: leido.pesos, fuente: leido.fuente ?? '' };
      }
    }
  } catch {
    // Clave pisada o almacenamiento cerrado.
  }
  return UVT_POR_DEFECTO;
};

const leerLista = (clave: string): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const crudo = localStorage.getItem(clave);
    if (crudo) {
      const leido = JSON.parse(crudo) as unknown;
      if (Array.isArray(leido)) return leido.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    // Igual.
  }
  return [];
};
