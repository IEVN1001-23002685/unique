import { RolAcceso, rutaDestinoPorRol, rutaDestinoSegura } from './acceso-registro';

describe('Redirección posterior al inicio de sesión real', () => {
  it('cada rol autenticado llega a su destino', () => {
    const esperado: Record<RolAcceso, string> = {
      CLIENTE: '/catalogo',
      OPERATIVO: '/panel',
      ADMIN: '/panel',
    };
    for (const rol of Object.keys(esperado) as RolAcceso[]) {
      expect(rutaDestinoPorRol(rol)).toBe(esperado[rol]);
      expect(rutaDestinoSegura(rol)).toBe(esperado[rol]);
    }
  });

  it('respeta un returnUrl interno y rechaza uno externo', () => {
    expect(rutaDestinoSegura('ADMIN', '/panel-admin/sistema')).toBe('/panel-admin/sistema');
    expect(rutaDestinoSegura('CLIENTE', 'https://externo.example')).toBe('/catalogo');
    expect(rutaDestinoSegura('OPERATIVO', '//externo.example')).toBe('/panel');
  });
});
