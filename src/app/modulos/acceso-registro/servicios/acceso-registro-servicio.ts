import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CredencialesLogin,
  DatosRegistroCliente,
  MENSAJES_M01,
  SesionAcceso,
} from '../modelos/acceso-registro';

/**
 * Contrato que deberá implementar Flask cuando exista HttpClient (§9 de UNIQUE v3.0):
 * POST /auth/registro · POST /auth/login · POST /auth/refrescar · POST /auth/logout ·
 * POST /auth/recuperar · POST /auth/restablecer.
 * No se crea ninguna petición ni se simula persistencia en esta etapa.
 */
export interface PuertoAutenticacion {
  registrarCliente(datos: DatosRegistroCliente): Observable<{ mensaje: string }>;
  iniciarSesion(credenciales: CredencialesLogin): Observable<SesionAcceso>;
  recuperar(correo: string): Observable<{ mensaje: string; tokenSimulado: string }>;
  restablecer(token: string, contrasena: string): Observable<{ mensaje: string }>;
}

/** Textos visibles que explican la limitación del frontend sin backend. */
@Injectable({ providedIn: 'root' })
export class AccesoRegistroServicio {
  readonly registroPendiente = MENSAJES_M01.registroPendiente;
  readonly ingresoPendiente = MENSAJES_M01.ingresoPendiente;
  readonly recuperacionPendiente = MENSAJES_M01.recuperacionPendiente;
  readonly restablecimientoPendiente = MENSAJES_M01.restablecimientoPendiente;
  readonly formularioInvalido = MENSAJES_M01.formularioInvalido;
}
