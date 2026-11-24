import { Injectable, computed, inject, signal } from '@angular/core';
import { PagosSimuladosServicio } from '../../../nucleo/servicios/pagos-simulados-servicio';
import { DESCUNTOS_SIMULADOS } from '../datos-simulados/descuentos';
import { VARIANTES_SIMULADAS } from '../datos-simulados/variantes';
import { VENTAS_SIMULADAS } from '../datos-simulados/ventas';
import type {
  ContextoDescuento,
  Descuento,
  LineaVenta,
  MetodoPago,
  PagoVenta,
  SolicitudVentaManual,
  Venta,
} from '../modelos/venta';

const dos = (valor: number): string => String(valor).padStart(2, '0');

/** Fecha local en formato AAAA-MM-DD, sin el desfase de toISOString(). */
export function fechaHoyIso(): string {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

function fechaAhoraIso(): string {
  const fecha = new Date();
  return `${fechaHoyIso()}T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`;
}

export interface DatosPagoRegistrado {
  monto: number;
  metodo: MetodoPago;
  ultimos4?: string | null;
  titular?: string | null;
  estado: 'APROBADO' | 'PENDIENTE';
}

export type ResultadoEliminacionDescuento = 'eliminado' | 'desactivado' | 'no-encontrado';

/**
 * Estado en memoria de M08 · Ventas.
 *
 * La interfaz pública está pensada para sustituirse por HttpClient contra:
 *   GET /ventas · GET /ventas/{id} · POST /ventas/manual
 *   POST /ventas/{id}/pago · POST /ventas/{id}/cancelar
 *   POST /ventas/{id}/reembolso · GET/POST/PATCH/DELETE /descuentos
 * Nada de lo que ocurre aquí persiste en servidor ni valida dinero real.
 */
@Injectable({
  providedIn: 'root',
})
export class VentasServicio {
  private readonly pagosSimulados = inject(PagosSimuladosServicio);
  private readonly listaVentas = signal<Venta[]>(structuredClone(VENTAS_SIMULADAS));
  private readonly listaDescuentos = signal<Descuento[]>(structuredClone(DESCUNTOS_SIMULADOS));

  readonly ventas = this.listaVentas.asReadonly();
  readonly descuentos = this.listaDescuentos.asReadonly();

  readonly indicadores = computed(() => {
    const hoy = fechaHoyIso();
    const mes = hoy.slice(0, 7);
    const activasDelMes = this.listaVentas().filter(
      (venta) => venta.estado === 'ACTIVA' && venta.fecha.startsWith(mes),
    );
    const totalMes = activasDelMes.reduce((suma, venta) => suma + venta.total, 0);

    return {
      dia: this.listaVentas()
        .filter((venta) => venta.estado === 'ACTIVA' && venta.fecha.startsWith(hoy))
        .reduce((suma, venta) => suma + venta.total, 0),
      mes: totalMes,
      ticket: activasDelMes.length === 0 ? 0 : totalMes / activasDelMes.length,
      pendientes: this.listaVentas().filter(
        (venta) => venta.estado === 'ACTIVA' && venta.estadoPago === 'PENDIENTE',
      ).length,
    };
  });

  obtenerVenta(folio: string): Venta | undefined {
    return this.listaVentas().find((venta) => venta.folio === folio);
  }

  obtenerDescuento(id: number): Descuento | undefined {
    return this.listaDescuentos().find((descuento) => descuento.id === id);
  }

  /** Tarifa de demostración documentada en §11.6: Local León, $200.00. */
  tarifaPorCodigoPostal(codigoPostal: string): { costo: number; dias: number } | null {
    if (!/^\d{5}$/.test(codigoPostal)) {
      return null;
    }

    const codigo = Number(codigoPostal);
    return codigo >= 37000 && codigo <= 37999 ? { costo: 200, dias: 2 } : null;
  }

  buscarCupon(codigo: string): Descuento | undefined {
    const normalizado = codigo.trim().toUpperCase();
    return this.listaDescuentos().find(
      (descuento) =>
        descuento.activo &&
        descuento.aplicacion === 'CUPON' &&
        descuento.codigo?.toUpperCase() === normalizado,
    );
  }

  validarDescuento(descuento: Descuento, contexto: ContextoDescuento) {
    const hoy = fechaHoyIso();

    if (!descuento.activo) {
      return { valido: false, motivo: 'El descuento está inactivo.', monto: 0 };
    }
    if (descuento.vigenteDesde > hoy) {
      return { valido: false, motivo: 'El descuento aún no entra en vigencia.', monto: 0 };
    }
    if (descuento.vigenteHasta !== null && descuento.vigenteHasta < hoy) {
      return { valido: false, motivo: 'El descuento ya venció.', monto: 0 };
    }
    if (descuento.usosMaximos !== null && descuento.usosActuales >= descuento.usosMaximos) {
      return { valido: false, motivo: 'Se agotaron los usos del descuento.', monto: 0 };
    }
    if (descuento.soloPrimeraCompra && !contexto.esPrimeraCompra) {
      return { valido: false, motivo: 'Solo aplica a la primera compra.', monto: 0 };
    }
    if (descuento.montoMinimo !== null && contexto.subtotal < descuento.montoMinimo) {
      return {
        valido: false,
        motivo: `Requiere un subtotal de $${descuento.montoMinimo}.`,
        monto: 0,
      };
    }
    if (descuento.minArticulos !== null && contexto.cantidadArticulos < descuento.minArticulos) {
      return {
        valido: false,
        motivo: `Requiere al menos ${descuento.minArticulos} artículos.`,
        monto: 0,
      };
    }

    const bruto =
      descuento.tipo === 'PORCENTAJE'
        ? (contexto.subtotal * descuento.valor) / 100
        : descuento.valor;

    return {
      valido: true,
      motivo: '',
      monto: Math.min(Math.round(bruto * 100) / 100, contexto.subtotal),
    };
  }

  descuentoAutomatico(contexto: ContextoDescuento): Descuento | undefined {
    return this.listaDescuentos()
      .filter((descuento) => descuento.activo && descuento.aplicacion === 'AUTOMATICO')
      .map((descuento) => ({
        descuento,
        monto: this.validarDescuento(descuento, contexto).monto,
        valido: this.validarDescuento(descuento, contexto).valido,
      }))
      .filter((candidato) => candidato.valido)
      .sort((a, b) => b.monto - a.monto)[0]?.descuento;
  }

  crearVentaManual(solicitud: SolicitudVentaManual): Venta {
    const lineas: LineaVenta[] = solicitud.lineas.flatMap(({ sku, cantidad }) => {
      const variante = VARIANTES_SIMULADAS.find((item) => item.sku === sku);
      if (!variante) {
        return [];
      }
      return [
        {
          sku: variante.sku,
          nombreProducto: variante.nombreProducto,
          talla: variante.talla,
          color: variante.color,
          cantidad,
          precioUnitario: variante.precioUnitario,
          subtotal: variante.precioUnitario * cantidad,
          costoEstandarUnitario: variante.costoEstandarUnitario,
        },
      ];
    });

    const subtotal = lineas.reduce((suma, linea) => suma + linea.subtotal, 0);
    const cantidadArticulos = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
    const descuento =
      solicitud.descuentoId === null
        ? null
        : (this.obtenerDescuento(solicitud.descuentoId) ?? null);
    const descuentoMonto =
      descuento === null
        ? 0
        : this.validarDescuento(descuento, {
            subtotal,
            cantidadArticulos,
            esPrimeraCompra: descuento.soloPrimeraCompra,
          }).monto;
    const total = subtotal - descuentoMonto + solicitud.costoEnvio;
    const iva = (total / 1.16) * 0.16;
    const consecutivo = this.siguienteConsecutivo();
    const anio = new Date().getFullYear();
    const ahora = fechaAhoraIso();
    const referencia = this.pagosSimulados.registrar({
      metodo: solicitud.metodoPago,
      ultimos4: solicitud.ultimos4,
      titular: solicitud.titular,
    });

    const pago: PagoVenta = {
      id: this.siguienteIdPago(),
      tipo: 'COBRO',
      metodo: solicitud.metodoPago,
      estado: solicitud.estadoPago === 'PAGADA' ? 'APROBADO' : 'PENDIENTE',
      monto: total,
      referencia: referencia.referencia,
      ultimos4: referencia.ultimos4,
      titular: referencia.titular,
      motivoRechazo: null,
      fecha: ahora,
      registradoPor: 'Administrador',
    };

    const venta: Venta = {
      id: this.listaVentas().reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1,
      folio: `UNQ-${anio}-${String(consecutivo).padStart(4, '0')}`,
      cliente: solicitud.cliente.nombre,
      clienteId: solicitud.cliente.esNuevoSinAcceso ? null : solicitud.cliente.id,
      fecha: ahora,
      canal: 'MANUAL',
      estado: 'ACTIVA',
      estadoPago: solicitud.estadoPago,
      estadoPedido: 'RECIBIDO',
      pedidoFolio: `PED-${anio}-${String(consecutivo).padStart(4, '0')}`,
      subtotal,
      descuentoId: descuento?.id ?? null,
      descuentoNombre: descuento?.nombre ?? null,
      descuentoMonto,
      costoEnvio: solicitud.costoEnvio,
      total,
      ivaIncluido: Math.round(iva * 100) / 100,
      requiereFactura: solicitud.direccionFacturacion.rfc !== null,
      fechaPromesa: null,
      canceladaEn: null,
      motivoCancelacion: null,
      creadaPor: 'Administrador',
      notas: 'Venta manual de demostración; sin persistencia en servidor.',
      lineas,
      direcciones: [solicitud.direccionEnvio, solicitud.direccionFacturacion],
      pagos: [pago],
    };

    this.listaVentas.update((actuales) => [...actuales, venta]);

    if (descuento !== null) {
      this.listaDescuentos.update((actuales) =>
        actuales.map((item) =>
          item.id === descuento.id ? { ...item, usosActuales: item.usosActuales + 1 } : item,
        ),
      );
    }

    return venta;
  }

  registrarPago(folio: string, datos: DatosPagoRegistrado): PagoVenta | null {
    const venta = this.obtenerVenta(folio);
    if (!venta || venta.estado === 'CANCELADA') {
      return null;
    }

    const referencia = this.pagosSimulados.registrar({
      metodo: datos.metodo,
      ultimos4: datos.ultimos4,
      titular: datos.titular,
    });
    const pago: PagoVenta = {
      id: this.siguienteIdPago(),
      tipo: 'COBRO',
      metodo: datos.metodo,
      estado: datos.estado,
      monto: datos.monto,
      referencia: referencia.referencia,
      ultimos4: referencia.ultimos4,
      titular: referencia.titular,
      motivoRechazo: null,
      fecha: fechaAhoraIso(),
      registradoPor: 'Administrador',
    };

    this.actualizarVenta(folio, (actual) => {
      const pagos = [...actual.pagos, pago];
      const cobrado = this.sumarCobrosAprobados(pagos);
      return {
        ...actual,
        pagos,
        estadoPago: datos.estado === 'APROBADO' && cobrado >= actual.total ? 'PAGADA' : 'PENDIENTE',
      };
    });

    return pago;
  }

  validarPago(folio: string): boolean {
    const venta = this.obtenerVenta(folio);
    const pendiente = venta?.pagos.find(
      (pago) => pago.tipo === 'COBRO' && pago.estado === 'PENDIENTE',
    );
    if (!venta || !pendiente) {
      return false;
    }

    this.actualizarVenta(folio, (actual) => {
      const pagos = actual.pagos.map((pago) =>
        pago.id === pendiente.id ? { ...pago, estado: 'APROBADO' as const } : pago,
      );
      const cobrado = this.sumarCobrosAprobados(pagos);
      return {
        ...actual,
        pagos,
        estadoPago: cobrado >= actual.total ? 'PAGADA' : actual.estadoPago,
      };
    });

    return true;
  }

  cancelarVenta(folio: string, motivo: string): boolean {
    const venta = this.obtenerVenta(folio);
    if (!venta || venta.estado === 'CANCELADA') {
      return false;
    }

    const cobrado = this.sumarCobrosAprobados(venta.pagos);
    this.actualizarVenta(folio, (actual) => {
      const pagos = [...actual.pagos];
      if (cobrado > 0) {
        const referencia = this.pagosSimulados.registrar({ metodo: 'TARJETA' });
        pagos.push({
          id: this.siguienteIdPago(),
          tipo: 'REEMBOLSO',
          metodo: 'TARJETA',
          estado: 'APROBADO',
          monto: cobrado,
          referencia: referencia.referencia,
          ultimos4: null,
          titular: null,
          motivoRechazo: null,
          fecha: fechaAhoraIso(),
          registradoPor: 'Administrador',
        });
      }

      return {
        ...actual,
        estado: 'CANCELADA',
        estadoPedido: 'CANCELADO',
        estadoPago: cobrado > 0 ? 'REEMBOLSADA' : actual.estadoPago,
        canceladaEn: fechaAhoraIso(),
        motivoCancelacion: motivo.trim(),
        pagos,
      };
    });

    return true;
  }

  reembolsar(folio: string, monto: number, motivo: string): boolean {
    const venta = this.obtenerVenta(folio);
    if (!venta || monto <= 0) {
      return false;
    }

    const referencia = this.pagosSimulados.registrar({ metodo: 'TARJETA' });
    this.actualizarVenta(folio, (actual) => {
      const pagos = [
        ...actual.pagos,
        {
          id: this.siguienteIdPago(),
          tipo: 'REEMBOLSO' as const,
          metodo: 'TARJETA' as const,
          estado: 'APROBADO' as const,
          monto,
          referencia: referencia.referencia,
          ultimos4: null,
          titular: null,
          motivoRechazo: null,
          fecha: fechaAhoraIso(),
          registradoPor: 'Administrador',
        },
      ];
      const reembolsado = pagos
        .filter((pago) => pago.tipo === 'REEMBOLSO' && pago.estado === 'APROBADO')
        .reduce((suma, pago) => suma + pago.monto, 0);

      return {
        ...actual,
        pagos,
        notas: motivo.trim(),
        estadoPago: reembolsado >= actual.total ? 'REEMBOLSADA' : 'REEMBOLSADA_PARCIAL',
      };
    });

    return true;
  }

  guardarDescuento(descuento: Descuento): void {
    const copia = structuredClone(descuento);
    if (copia.id === 0) {
      copia.id = this.listaDescuentos().reduce((maximo, item) => Math.max(maximo, item.id), 0) + 1;
      this.listaDescuentos.update((actuales) => [...actuales, copia]);
      return;
    }

    this.listaDescuentos.update((actuales) =>
      actuales.map((item) => (item.id === copia.id ? copia : item)),
    );
  }

  /** Si el descuento ya se usó, se desactiva; nunca se borra su historial. */
  eliminarDescuento(id: number): ResultadoEliminacionDescuento {
    const descuento = this.obtenerDescuento(id);
    if (!descuento) {
      return 'no-encontrado';
    }

    if (descuento.usosActuales > 0) {
      this.listaDescuentos.update((actuales) =>
        actuales.map((item) => (item.id === id ? { ...item, activo: false } : item)),
      );
      return 'desactivado';
    }

    this.listaDescuentos.update((actuales) => actuales.filter((item) => item.id !== id));
    return 'eliminado';
  }

  private actualizarVenta(folio: string, transformar: (venta: Venta) => Venta): void {
    this.listaVentas.update((actuales) =>
      actuales.map((venta) => (venta.folio === folio ? transformar(venta) : venta)),
    );
  }

  private sumarCobrosAprobados(pagos: PagoVenta[]): number {
    return pagos
      .filter((pago) => pago.tipo === 'COBRO' && pago.estado === 'APROBADO')
      .reduce((suma, pago) => suma + pago.monto, 0);
  }

  private siguienteConsecutivo(): number {
    return (
      this.listaVentas().reduce((maximo, venta) => {
        const consecutivo = Number(venta.folio.split('-').pop() ?? 0);
        return Math.max(maximo, Number.isFinite(consecutivo) ? consecutivo : 0);
      }, 480) + 1
    );
  }

  private siguienteIdPago(): number {
    return (
      this.listaVentas().reduce(
        (maximo, venta) =>
          venta.pagos.reduce((interno, pago) => Math.max(interno, pago.id), maximo),
        0,
      ) + 1
    );
  }
}
