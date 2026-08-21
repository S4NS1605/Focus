/**
 * `crypto.randomUUID` needs a secure context, which testing over a LAN IP is
 * not. Falls back so the app degrades instead of throwing on the first save.
 */
export const nuevoId = (prefijo = 'id'): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
};
