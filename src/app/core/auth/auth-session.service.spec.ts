import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PerfilSesionServicio } from '../../nucleo/servicios/perfil-sesion-servicio';
import { authInterceptor } from './auth.interceptor';
import { AuthStateService, type RespuestaSesion } from './auth-state.service';
import { AuthSessionService } from './auth-session.service';

const URL_LOGIN = `${environment.apiBaseUrl.replace(/\/$/, '')}/auth/login`;

const respuesta = (rol: 'CLIENTE' | 'OPERATIVO' | 'ADMIN') => ({
  access_token: 'token-real',
  usuario: {
    id: 7,
    nombre: 'Ana',
    apellidos: 'Pérez',
    correo: 'cuenta@unique.local',
    rol,
  },
});

describe('AuthSessionService · inicio de sesión real', () => {
  let http: HttpTestingController;
  let sesion: AuthSessionService;
  let estado: AuthStateService;
  let perfil: PerfilSesionServicio;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(AuthSessionService);
    estado = TestBed.inject(AuthStateService);
    perfil = TestBed.inject(PerfilSesionServicio);
  });

  afterEach(() => http.verify());

  it('envía correo y contraseña a /auth/login y adopta el rol devuelto por Flask', () => {
    const almacenamientoAntes = localStorage.length + sessionStorage.length;
    const recibidos: RespuestaSesion[] = [];

    sesion
      .iniciarSesion('operativo@unique.local', 'ClaveSegura123!')
      .subscribe((respuestaReal) => recibidos.push(respuestaReal));

    const peticion = http.expectOne(URL_LOGIN);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      correo: 'operativo@unique.local',
      password: 'ClaveSegura123!',
    });
    expect(peticion.request.withCredentials).toBe(true);
    peticion.flush(respuesta('OPERATIVO'));

    expect(recibidos[0].usuario.rol).toBe('OPERATIVO');
    expect(estado.token()).toBe('token-real');
    expect(estado.rol()).toBe('OPERATIVO');
    expect(estado.puede(['ADMIN', 'OPERATIVO'])).toBe(true);
    expect(estado.puede(['ADMIN'])).toBe(false);
    expect(perfil.perfil()).toBe('Operativo');
    expect(perfil.puedeVerCostos()).toBe(false);
    expect(localStorage.length + sessionStorage.length).toBe(almacenamientoAntes);
  });

  it('sin sesión no hay perfil ni permisos: no existe rol administrador por defecto', () => {
    expect(estado.autenticado()).toBe(false);
    expect(estado.rol()).toBeNull();
    expect(estado.puede(['ADMIN'])).toBe(false);
    expect(perfil.perfil()).toBeNull();
    expect(perfil.esAdministrador()).toBe(false);
    expect(perfil.puedeVerCostos()).toBe(false);
  });

  it('un ADMIN real ve costos y cumple permisos de OPERATIVO', () => {
    sesion.iniciarSesion('admin@unique.local', 'ClaveSegura123!').subscribe();
    http.expectOne(URL_LOGIN).flush(respuesta('ADMIN'));

    expect(estado.rol()).toBe('ADMIN');
    expect(perfil.perfil()).toBe('Administrador');
    expect(perfil.esAdministrador()).toBe(true);
    expect(perfil.puedeVerCostos()).toBe(true);
    expect(estado.puede(['OPERATIVO'])).toBe(true);
  });

  it('cerrar sesión borra token y rol reales', async () => {
    const fetchOriginal = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ csrf: 'csrf-token', con_refresco: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    try {
      sesion.iniciarSesion('cliente@unique.local', 'ClaveSegura123!').subscribe();
      http.expectOne(URL_LOGIN).flush(respuesta('CLIENTE'));
      expect(perfil.perfil()).toBe('Cliente');

      sesion.cerrarSesion().subscribe();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const peticion = http.expectOne(`${environment.apiBaseUrl.replace(/\/$/, '')}/auth/logout`);
      expect(peticion.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
      peticion.flush({ mensaje: 'Sesión cerrada' });

      expect(estado.autenticado()).toBe(false);
      expect(estado.rol()).toBeNull();
      expect(perfil.perfil()).toBeNull();
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
});
