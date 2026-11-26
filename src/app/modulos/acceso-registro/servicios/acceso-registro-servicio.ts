import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuthSessionService,
  DatosRegistroApi,
  MensajeApi,
  RespuestaSesion,
} from '../../../core/auth/auth-session.service';
import {
  CredencialesLogin,
  DatosRegistroCliente,
  MENSAJES_M01,
} from '../modelos/acceso-registro';

/** Servicio de M01. Los componentes solo invocan estos métodos. */
@Injectable({ providedIn: 'root' })
export class AccesoRegistroServicio {
  private readonly sesion = inject(AuthSessionService);

  readonly registroPendiente = MENSAJES_M01.registroPendiente;
  readonly ingresoPendiente = MENSAJES_M01.ingresoPendiente;
  readonly recuperacionPendiente = MENSAJES_M01.recuperacionPendiente;
  readonly restablecimientoPendiente = MENSAJES_M01.restablecimientoPendiente;
  readonly formularioInvalido = MENSAJES_M01.formularioInvalido;

  registrar(datos: DatosRegistroCliente): Observable<RespuestaSesion> {
    const cuerpo: DatosRegistroApi = {
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      correo: datos.correo,
      telefono: datos.telefono,
      password: datos.contrasena,
      acepta_privacidad: datos.aceptaPrivacidad,
      acepta_promociones: datos.recibirPromociones,
    };
    return this.sesion.registrar(cuerpo);
  }

  iniciarSesion(credenciales: CredencialesLogin): Observable<RespuestaSesion> {
    return this.sesion.iniciarSesion(credenciales.correo, credenciales.contrasena);
  }

  refrescar(): Observable<RespuestaSesion> {
    return this.sesion.refrescar();
  }

  cerrarSesion(): Observable<MensajeApi> {
    return this.sesion.cerrarSesion();
  }

  recuperar(correo: string): Observable<MensajeApi> {
    return this.sesion.recuperar(correo);
  }

  restablecer(token: string, contrasena: string): Observable<MensajeApi> {
    return this.sesion.restablecer(token, contrasena);
  }
}
