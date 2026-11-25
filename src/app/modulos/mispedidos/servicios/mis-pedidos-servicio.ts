import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';

export interface ArticuloPedido {
  nombre: string;
  sku: string;
  colorNombre: string;
  talla: string;
  cantidad: number;
  precioUnitarioConIva: number;
  ventaLineaId: number;
}

export interface PasoSeguimientoPedido {
  estado: string;
  fecha: string;
  descripcion: string;
  completado: boolean;
}

export interface PedidoCliente {
  id: number;
  folio: string;
  fecha: string;
  estado: string;
  totalConIva: number;
  direccionResumen: string;
  medioPagoResumen: string;
  guia: string | null;
  articulosCount: number;
  articulos: ArticuloPedido[];
  seguimiento: PasoSeguimientoPedido[];
}

export interface ComprobantePedido {
  folio: string;
  fecha: string;
  estado_pago: string;
  cliente: Record<string, string>;
  direccion: Record<string, string> | null;
  lineas: Array<{
    id: number;
    venta_linea_id: number;
    sku: string;
    nombre_producto: string;
    talla: string;
    color: string;
    cantidad: number;
    precio_unitario: string;
    subtotal: string;
  }>;
  subtotal: string;
  descuento_monto: string;
  costo_envio: string;
  total: string;
}

interface PedidoListaApi {
  id: number;
  folio: string;
  fecha: string;
  estado: string;
  total: string;
  articulos: number;
  guia: string | null;
}

interface PedidoLineaApi {
  id: number;
  venta_linea_id: number;
  sku: string;
  nombre_producto: string;
  talla: string;
  color: string;
  cantidad: number;
  precio_unitario: string;
  subtotal: string;
}

interface PedidoDetalleApi {
  id: number;
  folio: string;
  fecha: string;
  estado: string;
  estado_pago: string;
  total: string;
  total_articulos?: number;
  direccion: Record<string, string> | null;
  articulos: PedidoLineaApi[];
  eventos: Array<{ estado: string; descripcion: string; fecha: string }>;
  guia: string | null;
  repartidor: Record<string, string> | null;
}

interface ListaPaginada<T> {
  items: T[];
  total: number;
  pagina: number;
  por_pagina: number;
}

export const ETIQUETAS_ESTADO: Record<string, string> = {
  RECIBIDO: 'Recibido',
  CONFIRMADO: 'Confirmado',
  EN_PRODUCCION: 'En producción',
  EN_PREPARACION: 'En preparación',
  LISTO_ENVIO: 'Listo para envío',
  EN_REPARTO: 'En reparto',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const FILTROS_ESTADO = [
  { valor: 'TODOS', etiqueta: 'Todos' },
  { valor: 'EN_PROCESO', etiqueta: 'En proceso' },
  { valor: 'ENVIADOS', etiqueta: 'Enviados' },
  { valor: 'ENTREGADOS', etiqueta: 'Entregados' },
];

export function etiquetaEstado(codigo: string): string {
  return ETIQUETAS_ESTADO[codigo] ?? codigo;
}

function nombreColor(codigo: string): string {
  const nombres: Record<string, string> = {
    BL: 'Blanco',
    NG: 'Negro',
    GR: 'Gris',
    NA: 'No aplica',
  };
  return nombres[codigo] ?? codigo;
}

function resumenDireccion(direccion: Record<string, string> | null): string {
  if (!direccion) return 'Sin dirección registrada';
  return [
    direccion['calle'],
    direccion['numero_ext'] ? `#${direccion['numero_ext']}` : '',
    direccion['colonia'],
    direccion['municipio'],
    direccion['estado'],
    direccion['codigo_postal'] ? `(CP ${direccion['codigo_postal']})` : '',
  ]
    .filter(Boolean)
    .join(', ');
}

/** M06: historial, detalle, cancelación y comprobante del pedido propio. */
@Injectable({ providedIn: 'root' })
export class MisPedidosServicio {
  private readonly api = inject(ApiService);

  listar(estado = 'TODOS'): Observable<PedidoCliente[]> {
    return this.api
      .get<ListaPaginada<PedidoListaApi>>('/mis-pedidos', {
        params: estado === 'TODOS' ? {} : { estado },
      })
      .pipe(map((respuesta) => respuesta.items.map((pedido) => this.aPedido(pedido))));
  }

  detalle(pedidoId: number): Observable<PedidoCliente> {
    return this.api
      .get<PedidoDetalleApi>(`/mis-pedidos/${pedidoId}`)
      .pipe(map((pedido) => this.aDetalle(pedido)));
  }

  cancelar(pedidoId: number, motivo: string): Observable<PedidoCliente> {
    return this.api
      .post<PedidoDetalleApi>(`/mis-pedidos/${pedidoId}/cancelar`, { motivo })
      .pipe(map((pedido) => this.aDetalle(pedido)));
  }

  comprobante(pedidoId: number): Observable<ComprobantePedido> {
    return this.api.get<ComprobantePedido>(`/mis-pedidos/${pedidoId}/comprobante`);
  }

  private aPedido(pedido: PedidoListaApi): PedidoCliente {
    return {
      id: pedido.id,
      folio: pedido.folio,
      fecha: pedido.fecha,
      estado: pedido.estado,
      totalConIva: Number(pedido.total),
      direccionResumen: '',
      medioPagoResumen: '',
      guia: pedido.guia,
      articulosCount: pedido.articulos,
      articulos: [],
      seguimiento: [],
    };
  }

  private aDetalle(pedido: PedidoDetalleApi): PedidoCliente {
    return {
      ...this.aPedido(pedido),
      direccionResumen: resumenDireccion(pedido.direccion),
      medioPagoResumen: pedido.estado_pago,
      articulos: pedido.articulos.map((linea) => ({
        nombre: linea.nombre_producto,
        sku: linea.sku,
        colorNombre: nombreColor(linea.color),
        talla: linea.talla,
        cantidad: linea.cantidad,
        precioUnitarioConIva: Number(linea.precio_unitario),
        ventaLineaId: linea.venta_linea_id,
      })),
      seguimiento: pedido.eventos.map((evento) => ({
        estado: etiquetaEstado(evento.estado),
        fecha: evento.fecha,
        descripcion: evento.descripcion,
        completado: true,
      })),
    };
  }
}
