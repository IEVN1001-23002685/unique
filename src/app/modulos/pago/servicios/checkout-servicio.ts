import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';

export type MetodoPago = 'TARJETA' | 'CUENTA';

export interface LineaResumenCheckout {
  variante_id: number;
  sku: string;
  nombre_producto: string;
  talla: string;
  color: string;
  cantidad: number;
  precio_unitario: string;
  subtotal: string;
  disponibilidad: string;
}

export interface ResumenCheckout {
  subtotal: string;
  descuento_monto: string;
  costo_envio: string;
  iva_importe: string;
  total: string;
  monto_articulos: number;
  descuento: Record<string, unknown> | null;
  tarifa: Record<string, unknown> | null;
  lineas: LineaResumenCheckout[];
  fecha_promesa: string;
}

export interface DatosCotizacion {
  direccion_id?: number | null;
  codigo_postal?: string | null;
  descuento_codigo?: string | null;
  requiere_factura?: boolean;
  rfc?: string | null;
  razon_social?: string | null;
  cp_fiscal?: string | null;
}

export interface DatosPago extends DatosCotizacion {
  direccion?: Record<string, unknown> | null;
  metodo_pago: MetodoPago;
  medio_pago_id?: number | null;
  numero_tarjeta?: string | null;
  titular?: string | null;
  vence_mes?: number | null;
  vence_anio?: number | null;
  cvv?: string | null;
  notas?: string | null;
}

export interface DescuentoCheckout {
  codigo: string;
  nombre: string;
  tipo: string;
  valor: string;
  ahorro: string;
}

export interface ResultadoCheckout {
  venta: {
    id: number;
    folio: string;
    estado: string;
    estado_pago: string;
    total: string;
  };
  pedido: {
    id: number;
    folio: string;
    estado: string;
  };
  resumen: ResumenCheckout;
}

/** M05: cotización, descuentos y pago simulado contra Flask. */
@Injectable({ providedIn: 'root' })
export class CheckoutServicio {
  private readonly api = inject(ApiService);
  private readonly claves = new Map<string, string>();

  cotizar(datos: DatosCotizacion): Observable<ResumenCheckout> {
    return this.api.post<ResumenCheckout>('/checkout/cotizar', datos);
  }

  validarDescuento(codigo: string): Observable<DescuentoCheckout> {
    return this.api.post<DescuentoCheckout>('/checkout/descuento', { codigo });
  }

  pagar(datos: DatosPago): Observable<ResultadoCheckout> {
    return this.api.post<ResultadoCheckout>('/checkout/pagar', datos, {
      idempotencyKey: this.clavePara(datos),
    });
  }

  private clavePara(datos: DatosPago): string {
    const huella = JSON.stringify(datos);
    const existente = this.claves.get(huella);
    if (existente) return existente;
    const clave =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `chk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.claves.set(huella, clave);
    return clave;
  }
}
