import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';
import type {
  CoberturaEnvio,
  DatosActualizacionPerfil,
  DireccionCliente,
  MedioPagoSimulado,
  PerfilCuenta,
} from '../modelos/cuenta';

export type {
  CoberturaEnvio,
  DatosActualizacionPerfil,
  DireccionCliente,
  MedioPagoSimulado,
  PerfilCuenta,
} from '../modelos/cuenta';

interface DireccionApi {
  id: number;
  tipo: string;
  alias: string;
  destinatario: string;
  telefono: string;
  calle: string;
  numero_ext: string;
  numero_int: string | null;
  colonia: string;
  municipio: string;
  estado: string;
  codigo_postal: string;
  referencia: string | null;
  rfc: string | null;
  razon_social: string | null;
  predeterminada: boolean;
}

interface MedioPagoApi {
  id: number;
  tipo: string;
  alias: string;
  titular: string;
  ultimos4: string;
  marca: string | null;
  vence_mes: number | null;
  vence_anio: number | null;
  saldo_simulado: string | null;
}

/**
 * Contratos de M02 contra la API documentada en §9. No hay persistencia local:
 * las respuestas exitosas solo actualizan la señal de la vista que las invocó.
 */
@Injectable({ providedIn: 'root' })
export class CuentaServicio {
  private readonly api = inject(ApiService);

  perfil(): Observable<PerfilCuenta> {
    return this.api.get<PerfilCuenta>('/cuenta');
  }

  actualizarPerfil(datos: DatosActualizacionPerfil): Observable<PerfilCuenta> {
    return this.api.patch<PerfilCuenta>('/cuenta', datos);
  }

  cambiarContrasena(contrasenaActual: string, contrasenaNueva: string): Observable<{ mensaje: string }> {
    return this.api.patch<{ mensaje: string }>('/cuenta/contrasena', {
      contrasena_actual: contrasenaActual,
      contrasena_nueva: contrasenaNueva,
    });
  }

  /** §7 M02: estado INACTIVA sin borrar el historial. Flask aplica la regla autoritativa. */
  desactivarCuenta(): Observable<{ mensaje: string }> {
    return this.api.patch<{ mensaje: string }>('/cuenta/desactivar');
  }

  listarDirecciones(): Observable<DireccionCliente[]> {
    return this.api
      .get<DireccionApi[]>('/cuenta/direcciones')
      .pipe(map((items) => items.map((item) => this.aDireccion(item))));
  }

  crearDireccion(direccion: DireccionCliente): Observable<DireccionCliente> {
    return this.api
      .post<DireccionApi>('/cuenta/direcciones', this.aApiDireccion(direccion))
      .pipe(map((item) => this.aDireccion(item)));
  }

  actualizarDireccion(id: number, direccion: DireccionCliente): Observable<DireccionCliente> {
    return this.api
      .patch<DireccionApi>(`/cuenta/direcciones/${id}`, this.aApiDireccion(direccion))
      .pipe(map((item) => this.aDireccion(item)));
  }

  /** El servidor desactiva el registro; las ventas conservan su propia copia. */
  eliminarDireccion(id: number): Observable<void> {
    return this.api.delete<void>(`/cuenta/direcciones/${id}`);
  }

  listarMediosPago(): Observable<MedioPagoSimulado[]> {
    return this.api
      .get<MedioPagoApi[]>('/cuenta/medios-pago')
      .pipe(map((items) => items.map((item) => this.aMedioPago(item))));
  }

  crearMedioPago(cuerpo: Record<string, unknown>): Observable<MedioPagoSimulado> {
    return this.api
      .post<MedioPagoApi>('/cuenta/medios-pago', cuerpo)
      .pipe(map((item) => this.aMedioPago(item)));
  }

  actualizarMedioPago(id: number, alias: string): Observable<MedioPagoSimulado> {
    return this.api
      .patch<MedioPagoApi>(`/cuenta/medios-pago/${id}`, { alias })
      .pipe(map((item) => this.aMedioPago(item)));
  }

  eliminarMedioPago(id: number): Observable<void> {
    return this.api.delete<void>(`/cuenta/medios-pago/${id}`);
  }

  cobertura(cp: string): Observable<CoberturaEnvio> {
    return this.api.get<CoberturaEnvio>('/envio/cobertura', { params: { cp } });
  }

  private aDireccion(item: DireccionApi): DireccionCliente {
    return {
      id: item.id,
      tipo: String(item.tipo).toLowerCase() === 'facturacion' ? 'facturacion' : 'envio',
      alias: item.alias,
      destinatario: item.destinatario,
      telefono: item.telefono,
      calle: item.calle,
      numExt: item.numero_ext,
      numInt: item.numero_int ?? '',
      colonia: item.colonia,
      municipio: item.municipio,
      estado: item.estado,
      cp: item.codigo_postal,
      referencia: item.referencia ?? '',
      predeterminada: item.predeterminada,
      rfc: item.rfc ?? '',
      razonSocial: item.razon_social ?? '',
    };
  }

  private aApiDireccion(item: DireccionCliente): Record<string, unknown> {
    return {
      tipo: item.tipo.toUpperCase(),
      alias: item.alias,
      destinatario: item.destinatario,
      telefono: item.telefono,
      calle: item.calle,
      numero_ext: item.numExt,
      numero_int: item.numInt || null,
      colonia: item.colonia,
      municipio: item.municipio,
      estado: item.estado,
      codigo_postal: item.cp,
      referencia: item.referencia || null,
      rfc: item.tipo === 'facturacion' ? item.rfc || null : null,
      razon_social: item.tipo === 'facturacion' ? item.razonSocial || null : null,
      predeterminada: item.predeterminada,
    };
  }

  private aMedioPago(item: MedioPagoApi): MedioPagoSimulado {
    const esTarjeta = String(item.tipo).toUpperCase() === 'TARJETA';
    return {
      id: item.id,
      tipo: esTarjeta ? 'tarjeta' : 'cuenta',
      alias: item.alias,
      titular: item.titular,
      marca: item.marca ?? undefined,
      ultimos4: item.ultimos4,
      vencimiento:
        esTarjeta && item.vence_mes && item.vence_anio
          ? `${String(item.vence_mes).padStart(2, '0')}/${String(item.vence_anio).slice(-2)}`
          : undefined,
      saldo: item.saldo_simulado === null ? undefined : Number(item.saldo_simulado),
    };
  }
}
