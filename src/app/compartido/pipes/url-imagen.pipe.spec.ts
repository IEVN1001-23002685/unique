import { environment } from '../../../environments/environment';
import { UrlImagenPipe } from './url-imagen.pipe';

describe('UrlImagenPipe', () => {
  const pipe = new UrlImagenPipe();
  const origen = environment.apiBaseUrl.replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '');

  it('resuelve las imágenes de Flask contra el origen de la API', () => {
    expect(pipe.transform('/uploads/abc123.png')).toBe(`${origen}/uploads/abc123.png`);
    expect(pipe.transform('uploads/abc123.png')).toBe(`${origen}/uploads/abc123.png`);
  });

  it('deja intactos los recursos locales y las URLs ya absolutas', () => {
    expect(pipe.transform('/prendas/sudadera/Sudaderanegra.png')).toBe(
      '/prendas/sudadera/Sudaderanegra.png',
    );
    expect(pipe.transform('https://otro-dominio/upload.png')).toBe(
      'https://otro-dominio/upload.png',
    );
    expect(pipe.transform('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(pipe.transform('blob:http://localhost:4200/abc')).toBe(
      'blob:http://localhost:4200/abc',
    );
  });

  it('devuelve cadena vacía cuando no hay imagen', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });
});
