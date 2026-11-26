import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';

/** Modelos de interfaz de M06. Flask sigue siendo la fuente autoritativa del pedido. */

export interface ArticuloPedido {
  nombre: string;
  sku: string;
  colorNombre: string;
  talla: string;
  cantidad: number;
  precioUnitarioConIva: number;
  ventaLineaId: number;
  varianteId: number;
  productoId: number;
  imagenUrl?: string;
}

export interface PasoSeguimientoPedido {
  codigo: string;
  estado: string;
  fecha: string;
  descripcion: string;
  completado: boolean;
}

export interface RepartidorPedido {
  nombre: string;
  telefono: string;
}

export interface PedidoCliente {
  id: number;
  folio: string;
  fecha: string;
  estado: string;
  estadoPago: string;
  totalConIva: number;
  subtotal: number | null;
  descuento: number | null;
  envio: number | null;
  direccionResumen: string;
  medioPagoResumen: string;
  guia: string | null;
  fechaEntrega: string | null;
  fechaEstimada: string | null;
  repartidor: RepartidorPedido | null;
  articulosCount: number;
  miniaturaUrl?: string;
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
  articulos?: number | null;
  guia?: string | null;
  imagen?: string | null;
  fecha_entrega?: string | null;
  fecha_estimada?: string | null;
}

interface PedidoLineaApi {
  id: number;
  venta_linea_id: number;
  variante_id: number;
  producto_id: number;
  sku: string;
  nombre_producto: string;
  talla: string;
  color: string;
  cantidad: number;
  precio_unitario: string;
  subtotal: string;
  imagen?: string | null;
}

interface PedidoDetalleApi {
  id: number;
  folio: string;
  fecha: string;
  estado: string;
  estado_pago?: string;
  total: string;
  total_articulos?: number;
  subtotal?: string | null;
  descuento_monto?: string | null;
  costo_envio?: string | null;
  direccion?: Record<string, string> | null;
  articulos: PedidoLineaApi[] | null;
  eventos: Array<{
    estado: string;
    descripcion: string;
    fecha: string;
    visible_cliente?: boolean;
  }> | null;
  guia?: string | null;
  fecha_entrega?: string | null;
  fecha_estimada?: string | null;
  repartidor?: Record<string, string> | null;
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
  LISTO_ENVIO: 'Verificado',
  EN_REPARTO: 'Enviado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const FILTROS_ESTADO = [
  { valor: 'TODOS', etiqueta: 'Todos' },
  { valor: 'EN_PROCESO', etiqueta: 'En proceso' },
  { valor: 'ENVIADOS', etiqueta: 'Enviados' },
  { valor: 'ENTREGADOS', etiqueta: 'Entregados' },
] as const;

/** Pasos visibles en la línea de tiempo; EN_PRODUCCION solo se muestra si ocurrió. */
export const PASOS_ESTADO = [
  { codigo: 'RECIBIDO', etiqueta: 'Pedido recibido' },
  { codigo: 'CONFIRMADO', etiqueta: 'Pedido confirmado' },
  { codigo: 'EN_PRODUCCION', etiqueta: 'En producción' },
  { codigo: 'LISTO_ENVIO', etiqueta: 'Verificado' },
  { codigo: 'EN_REPARTO', etiqueta: 'Enviado' },
  { codigo: 'ENTREGADO', etiqueta: 'Entregado' },
] as const;

/** CANCELABLES y la ventana de posventa son reglas de negocio de M06 (§7). */
export const ESTADOS_CANCELABLES = ['RECIBIDO', 'CONFIRMADO', 'EN_PRODUCCION'] as const;
export const DIAS_DEVOLUCION = 15;

export function etiquetaEstado(codigo: string): string {
  return ETIQUETAS_ESTADO[codigo] ?? codigo;
}

function numero(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const resultado = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(resultado) ? resultado : null;
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

/** M06: historial, detalle, cancelación y comprobante del pedido propio (§9). */
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

  /** Descarga del comprobante digital empleando el mismo contrato documentado. */
  descargarComprobante(pedidoId: number): Observable<Blob> {
    return this.api.getBlob(`/mis-pedidos/${pedidoId}/comprobante`);
  }

  private aPedido(pedido: PedidoListaApi): PedidoCliente {
    return {
      id: pedido.id,
      folio: pedido.folio,
      fecha: pedido.fecha,
      estado: pedido.estado,
      estadoPago: '',
      totalConIva: numero(pedido.total) ?? 0,
      subtotal: null,
      descuento: null,
      envio: null,
      direccionResumen: '',
      medioPagoResumen: '',
      guia: pedido.guia ?? null,
      fechaEntrega: pedido.fecha_entrega ?? null,
      fechaEstimada: pedido.fecha_estimada ?? null,
      repartidor: null,
      articulosCount: pedido.articulos ?? 0,
      miniaturaUrl: pedido.imagen ?? undefined,
      articulos: [],
      seguimiento: [],
    };
  }

  private aDetalle(pedido: PedidoDetalleApi): PedidoCliente {
    const repartidor = pedido.repartidor;
    return {
      id: pedido.id,
      folio: pedido.folio,
      fecha: pedido.fecha,
      estado: pedido.estado,
      estadoPago: pedido.estado_pago ?? '',
      totalConIva: numero(pedido.total) ?? 0,
      subtotal: numero(pedido.subtotal),
      descuento: numero(pedido.descuento_monto),
      envio: numero(pedido.costo_envio),
      direccionResumen: resumenDireccion(pedido.direccion ?? null),
      medioPagoResumen: etiquetaEstadoPago(pedido.estado_pago),
      guia: pedido.guia ?? null,
      fechaEntrega: pedido.fecha_entrega ?? null,
      fechaEstimada: pedido.fecha_estimada ?? null,
      repartidor: repartidor
        ? {
            nombre: repartidor['nombre'] ?? 'Repartidor por asignar',
            telefono: repartidor['telefono'] ?? repartidor['celular'] ?? '',
          }
        : null,
      articulosCount: pedido.total_articulos ?? pedido.articulos?.length ?? 0,
      miniaturaUrl: pedido.articulos?.find((linea) => linea.imagen)?.imagen ?? undefined,
      articulos: (pedido.articulos ?? []).map((linea) => ({
        nombre: linea.nombre_producto,
        sku: linea.sku,
        colorNombre: nombreColor(linea.color),
        talla: linea.talla,
        cantidad: linea.cantidad,
        precioUnitarioConIva: numero(linea.precio_unitario) ?? 0,
        ventaLineaId: linea.venta_linea_id,
        varianteId: linea.variante_id,
        productoId: linea.producto_id,
        imagenUrl: linea.imagen ?? undefined,
      })),
      seguimiento: (pedido.eventos ?? [])
        .filter((evento) => evento.visible_cliente !== false)
        .map((evento) => ({
          codigo: evento.estado,
          estado: etiquetaEstado(evento.estado),
          fecha: evento.fecha,
          descripcion: evento.descripcion,
          completado: true,
        })),
    };
  }
}

function etiquetaEstadoPago(estado: string): string {
  const etiquetas: Record<string, string> = {
    PAGADA: 'Pagada',
    PENDIENTE: 'Pendiente',
    RECHAZADA: 'Rechazada',
    REEMBOLSADA: 'Reembolsada',
  };
  return etiquetas[estado] ?? estado || 'Estado de pago no disponible';
}
