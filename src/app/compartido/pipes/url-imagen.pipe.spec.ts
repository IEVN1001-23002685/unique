import { environment } from '../../../environments/environment';
import { resolverUrlImagen } from './url-imagen.pipe';

describe('resolverUrlImagen', () => {
  const base = environment.apiBaseUrl.replace(/\/+$/, '');

  it('resuelve las imágenes de Flask contra el origen de la API configurado', () => {
    expect(resolverUrlImagen('/uploads/abc123.png', base)).toBe(
      'http://localhost:8001/uploads/abc123.png',
    );
    expect(resolverUrlImagen('uploads/abc123.png', base)).toBe(
      'http://localhost:8001/uploads/abc123.png',
    );
  });

  it('deja intactos los recursos locales y las URLs ya absolutas', () => {
    expect(resolverUrlImagen('/prendas/sudadera/Sudaderanegra.png', base)).toBe(
      '/prendas/sudadera/Sudaderanegra.png',
    );
    expect(resolverUrlImagen('https://otro-dominio/upload.png', base)).toBe(
      'https://otro-dominio/upload.png',
    );
    expect(resolverUrlImagen('data:image/png;base64,AAA', base)).toBe(
      'data:image/png;base64,AAA',
    );
    expect(resolverUrlImagen('blob:http://localhost:4200/abc', base)).toBe(
      'blob:http://localhost:4200/abc',
    );
  });

  it('no genera rutas relativas cuando falta la configuración', () => {
    expect(resolverUrlImagen('/uploads/abc123.png', '')).toBe('');
    expect(resolverUrlImagen('', base)).toBe('');
    expect(resolverUrlImagen(null, base)).toBe('');
    expect(resolverUrlImagen(undefined, base)).toBe('');
  });
});
