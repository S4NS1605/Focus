import { describe, expect, it } from 'vitest';
import { motivoParaNoBorrar, motivoParaRechazar } from './superadmin';

const ctx = (over: Partial<Parameters<typeof motivoParaRechazar>[1]> = {}) => ({
  editorId: 'admin-1',
  objetivoId: 'usuario-2',
  objetivoRol: 'usuario' as const,
  totalAdmins: 2,
  ...over,
});

describe('motivoParaRechazar', () => {
  it('deja pasar un cambio normal a otro usuario', () => {
    expect(motivoParaRechazar({ usuario: 'Lala', password: 'secreto1' }, ctx())).toBeNull();
  });

  it('no te deja quitarte a ti mismo el rol de admin', () => {
    // Es sacarte del panel en el mismo clic. Casi siempre un accidente.
    const r = motivoParaRechazar(
      { rol: 'usuario' },
      ctx({ objetivoId: 'admin-1', objetivoRol: 'admin', totalAdmins: 2 }),
    );
    expect(r).toMatch(/ti mismo/i);
  });

  it('no te deja degradar al último administrador que queda', () => {
    const r = motivoParaRechazar(
      { rol: 'usuario' },
      ctx({ editorId: 'admin-1', objetivoId: 'admin-9', objetivoRol: 'admin', totalAdmins: 1 }),
    );
    expect(r).toMatch(/sin ningún administrador/i);
  });

  it('sí deja degradar a un admin cuando queda otro', () => {
    expect(
      motivoParaRechazar(
        { rol: 'usuario' },
        ctx({ editorId: 'admin-1', objetivoId: 'admin-9', objetivoRol: 'admin', totalAdmins: 2 }),
      ),
    ).toBeNull();
  });

  it('rechaza una contraseña más corta que el mínimo', () => {
    expect(motivoParaRechazar({ password: '123' }, ctx())).toMatch(/al menos 6/i);
    // Justo en el límite pasa.
    expect(motivoParaRechazar({ password: '123456' }, ctx())).toBeNull();
  });

  it('rechaza un nombre de usuario en blanco, pero no uno ausente', () => {
    expect(motivoParaRechazar({ usuario: '   ' }, ctx())).toMatch(/no puede quedar vacío/i);
    // No tocar el usuario es distinto de vaciarlo.
    expect(motivoParaRechazar({ email: 'nuevo@correo.com' }, ctx())).toBeNull();
  });

  it('no confunde subir de rol con bajar', () => {
    // Ascender a un usuario a admin nunca deja el sistema sin administradores.
    expect(
      motivoParaRechazar({ rol: 'admin' }, ctx({ objetivoRol: 'usuario', totalAdmins: 1 })),
    ).toBeNull();
  });
});

describe('motivoParaNoBorrar', () => {
  it('deja borrar a otro usuario normal', () => {
    expect(motivoParaNoBorrar(ctx())).toBeNull();
  });

  it('no te deja borrarte a ti mismo', () => {
    expect(motivoParaNoBorrar(ctx({ objetivoId: 'admin-1' }))).toMatch(/tu propia cuenta/i);
  });

  it('no deja borrar al último administrador', () => {
    expect(
      motivoParaNoBorrar(ctx({ objetivoId: 'admin-9', objetivoRol: 'admin', totalAdmins: 1 })),
    ).toMatch(/último administrador/i);
  });

  it('sí deja borrar a un admin cuando queda otro', () => {
    expect(
      motivoParaNoBorrar(ctx({ objetivoId: 'admin-9', objetivoRol: 'admin', totalAdmins: 2 })),
    ).toBeNull();
  });
});
