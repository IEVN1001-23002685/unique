import { Injectable } from '@angular/core';

/**
 * Seam compartido con M05 · Pago.
 *
 * Genera únicamente una referencia simulada SIM-000123 y los últimos cuatro
 * dígitos opcionales. Nunca recibe, guarda ni envía PAN, CVV ni datos bancarios
 * reales. No persiste nada: la integración con la pasarela simulada de Flask
 * sustituirá este servicio sin cambiar las pantallas.
 */

export type MetodoPagoSimulado = 'TARJETA' | 'CUENTA' | 'TRANSFERENCIA' | 'EFECTIVO';

export interface SolicitudPagoSimulado {
  metodo: MetodoPagoSimulado;
  ultimos4?: string | null;
  titular?: string | null;
}

export interface ResultadoPagoSimulado {
  referencia: string;
  ultimos4: string | null;
  titular: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class PagosSimuladosServicio {
  private secuencia = 122;

  registrar(solicitud: SolicitudPagoSimulado): ResultadoPagoSimulado {
    const consecutivo = ++this.secuencia;
    const ultimos4 = solicitud.metodo === 'TARJETA' ? (solicitud.ultimos4?.trim() ?? '') : '';
    const titular = solicitud.titular?.trim() ?? '';

    return {
      referencia: `SIM-${String(consecutivo).padStart(6, '0')}`,
      ultimos4: ultimos4 === '' ? null : ultimos4,
      titular: titular === '' ? null : titular,
    };
  }
}
