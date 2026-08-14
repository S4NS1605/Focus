/**
 * Las reglas que impiden que un administrador se deje a sí mismo por fuera.
 *
 * Viven aparte del endpoint, y en código puro, porque son lo único de esta
 * función que de verdad hay que probar: el resto es hablar con Supabase. Un
 * admin que se borra a sí mismo, o que se quita el rol, o que degrada al último
 * administrador que queda, deja el panel sin nadie que pueda entrar — y eso no
 * se arregla desde la app, toca ir a la base a mano.
 *
 * El servidor es la frontera real: el navegador puede validar lo mismo para
 * avisar antes, pero estas comprobaciones se hacen aquí pase lo que pase.
 */

/** El mínimo que exige Supabase Auth. Menos que esto lo rechaza igual. */
export const LARGO_MIN_PASSWORD = 6;

export interface CambiosUsuario {
  usuario?: string;
  email?: string;
  password?: string;
  rol?: 'admin' | 'usuario';
}

export interface ContextoEdicion {
  /** Quién está pulsando los botones. */
  editorId: string;
  /** A quién se le aplican los cambios. */
  objetivoId: string;
  /** El rol que el objetivo tiene AHORA, antes de este cambio. */
  objetivoRol: 'admin' | 'usuario';
  /** Cuántos administradores hay en total AHORA. */
  totalAdmins: number;
}

/**
 * El motivo por el que un cambio no se puede aplicar, o `null` si sí se puede.
 *
 * Devuelve texto listo para mostrar, no un código: quien llama solo tiene que
 * enseñarlo. El orden importa poco porque cada regla cubre un caso distinto,
 * pero se revisa primero lo que deja el sistema inservible (quedarse sin admin)
 * y después lo cosmético (una contraseña corta).
 */
export const motivoParaRechazar = (
  cambios: CambiosUsuario,
  ctx: ContextoEdicion,
): string | null => {
  const esSuPropiaCuenta = ctx.editorId === ctx.objetivoId;
  const quitaAdmin = ctx.objetivoRol === 'admin' && cambios.rol === 'usuario';

  // Quitarte a ti mismo el rol te saca del panel en el mismo clic. Aunque
  // hubiera otro admin, es casi siempre un accidente, así que se bloquea.
  if (esSuPropiaCuenta && quitaAdmin) {
    return 'No puedes quitarte a ti mismo el rol de administrador.';
  }

  // Degradar al último administrador deja el panel sin nadie. Da igual si es
  // uno mismo u otro: si al aplicarlo no queda ningún admin, no se aplica.
  if (quitaAdmin && ctx.totalAdmins <= 1) {
    return 'Quedarías sin ningún administrador. Nombra otro antes de quitar este.';
  }

  if (cambios.password !== undefined && cambios.password.length < LARGO_MIN_PASSWORD) {
    return `La contraseña debe tener al menos ${LARGO_MIN_PASSWORD} caracteres.`;
  }

  if (cambios.usuario !== undefined && cambios.usuario.trim() === '') {
    return 'El nombre de usuario no puede quedar vacío.';
  }

  return null;
};

/**
 * El motivo por el que un usuario no se puede borrar, o `null` si sí.
 *
 * Borrar es aparte de editar porque es irreversible: se lleva la cuenta de auth
 * y, en cascada, todo lo que colgaba de ella. Las dos trampas son la misma de
 * arriba llevadas al extremo — borrarte a ti mismo, o borrar al último admin.
 */
export const motivoParaNoBorrar = (ctx: ContextoEdicion): string | null => {
  if (ctx.editorId === ctx.objetivoId) {
    return 'No puedes eliminar tu propia cuenta.';
  }

  if (ctx.objetivoRol === 'admin' && ctx.totalAdmins <= 1) {
    return 'No puedes eliminar al último administrador.';
  }

  return null;
};
