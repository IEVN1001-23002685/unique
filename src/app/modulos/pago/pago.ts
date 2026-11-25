import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { mensajeError } from '../../core/api/errores';
import { CarritoServicio } from '../carrito/servicios/carrito-servicio';
import { CuentaServicio } from '../micuenta/servicios/cuenta-servicio';
import type { DireccionCliente } from '../micuenta/micuenta';
import {
  CheckoutServicio,
  DatosCotizacion,
  DatosPago,
  DescuentoCheckout,
  ResumenCheckout,
} from './servicios/checkout-servicio';

export interface ResumenItemCheckout {
  idLinea: string;
  nombre: string;
  sku: string;
  colorNombre: string;
  talla: string;
  cantidad: number;
  precioUnitarioConIva: number;
}

export type OpcionDireccionCheckout = DireccionCliente;

export interface OpcionPagoCheckout {
  id: number;
  tipo: 'tarjeta' | 'cuenta' | 'nueva-tarjeta';
  alias: string;
  detalle: string;
  saldoDisponible?: number;
}

export interface ConfirmacionPedidoCheckout {
  folio: string;
  pedidoId: number;
  ventaId: number;
  direccionEnvioId: number | 'nueva';
  requiereFactura: boolean;
  medioPagoId: number | null;
  totalPagado: number;
}

const NUEVA_TARJETA_ID = -1;

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pago.html',
  styles: [],
})
export class Pago implements OnInit {
  private readonly router = inject(Router);
  private readonly carrito = inject(CarritoServicio);
  private readonly cuenta = inject(CuentaServicio);
  private readonly checkout = inject(CheckoutServicio);
  private itemsRecibidos: ResumenItemCheckout[] | null = null;

  @Input() set items(items: ResumenItemCheckout[]) {
    this.itemsRecibidos = items;
  }
  get items(): ResumenItemCheckout[] {
    if (this.itemsRecibidos) return this.itemsRecibidos;
    return this.carrito.items().map((item) => ({
      idLinea: item.idLinea,
      nombre: item.nombre,
      sku: item.sku,
      colorNombre: item.colorNombre,
      talla: item.talla,
      cantidad: item.cantidad,
      precioUnitarioConIva: item.precioUnitarioConIva,
    }));
  }

  @Output() volverAlCarrito = new EventEmitter<void>();
  @Output() cerrar = new EventEmitter<void>();
  @Output() pedidoConfirmado = new EventEmitter<ConfirmacionPedidoCheckout>();

  direccionesEnvio: OpcionDireccionCheckout[] = [];
  direccionesFacturacion: OpcionDireccionCheckout[] = [];
  mediosPago: OpcionPagoCheckout[] = [];

  direccionSeleccionadaId: number | 'nueva' = 'nueva';
  nuevaDireccion = {
    alias: '',
    destinatario: '',
    telefono: '',
    calle: '',
    numExt: '',
    colonia: '',
    municipio: '',
    estado: '',
    cp: '',
  };

  requiereFactura = false;
  direccionFactId: number | null = null;
  rfcFactura = '';
  razonSocialFactura = '';
  codigoDescuento = '';
  descuentoAplicado: DescuentoCheckout | null = null;

  medioPagoSeleccionadoId: number | null = null;
  nuevaTarjeta = { numero: '', titular: '', vencimiento: '', cvv: '' };

  resumen: ResumenCheckout | null = null;
  mensajeError = '';
  folioGenerado = '';
  totalPagado = 0;
  cargando = true;
  procesando = false;

  ngOnInit(): void {
    forkJoin({
      envio: this.cuenta.listarDirecciones(),
      medios: this.cuenta.listarMediosPago(),
      carrito: this.carrito.cargar(),
    }).subscribe({
      next: ({ envio, medios }) => {
        this.direccionesEnvio = envio.filter((direccion) => direccion.tipo === 'envio');
        this.direccionesFacturacion = envio.filter(
          (direccion) => direccion.tipo === 'facturacion',
        );
        this.mediosPago = [
          ...medios.map((medio) => this.aOpcionPago(medio)),
          {
            id: NUEVA_TARJETA_ID,
            tipo: 'nueva-tarjeta',
            alias: 'Nueva tarjeta',
            detalle: 'Captura una tarjeta simulada para esta compra',
          },
        ];

        const predeterminada =
          this.direccionesEnvio.find((direccion) => direccion.predeterminada) ??
          this.direccionesEnvio[0];
        this.direccionSeleccionadaId = predeterminada ? predeterminada.id : 'nueva';

        const fiscal =
          this.direccionesFacturacion.find((direccion) => direccion.predeterminada) ??
          this.direccionesFacturacion[0];
        if (fiscal) {
          this.direccionFactId = fiscal.id;
          this.rfcFactura = fiscal.rfc ?? '';
          this.razonSocialFactura = fiscal.razonSocial ?? '';
        }
        this.medioPagoSeleccionadoId = this.mediosPago[0]?.id ?? null;
        this.cargando = false;
        this.actualizarCotizacion();
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.mensajeError = mensajeError(error, 'No fue posible preparar el pago.');
      },
    });
  }

  get subtotalConIva(): number {
    return Number(this.resumen?.subtotal ?? 0);
  }

  get descuentoAplicadoMonto(): number {
    return Number(this.resumen?.descuento_monto ?? 0);
  }

  get costoEnvio(): number {
    return Number(this.resumen?.costo_envio ?? 0);
  }

  get totalPagar(): number {
    return Number(this.resumen?.total ?? this.subtotalConIva);
  }

  get nombreTarifa(): string {
    const tarifa = this.resumen?.tarifa;
    return tarifa && typeof tarifa['nombre'] === 'string' ? tarifa['nombre'] : 'Tarifa vigente';
  }

  get diasEntrega(): number | null {
    const tarifa = this.resumen?.tarifa;
    return tarifa && typeof tarifa['dias_estimados'] === 'number'
      ? tarifa['dias_estimados']
      : null;
  }

  get cpActivo(): string {
    if (this.direccionSeleccionadaId === 'nueva') return this.nuevaDireccion.cp;
    const encontrada = this.direccionesEnvio.find(
      (direccion) => direccion.id === this.direccionSeleccionadaId,
    );
    return encontrada ? encontrada.cp : '';
  }

  get coberturaValida(): boolean {
    return /^\d{5}$/.test(this.cpActivo);
  }

  get pagoSeleccionado(): OpcionPagoCheckout | undefined {
    return this.mediosPago.find((medio) => medio.id === this.medioPagoSeleccionadoId);
  }

  irAlCarrito(): void {
    this.volverAlCarrito.emit();
    void this.router.navigate(['/carrito']);
  }

  cerrarPago(): void {
    this.cerrar.emit();
    void this.router.navigate(['/catalogo']);
  }

  verMisPedidos(): void {
    void this.router.navigate(['/pedidos']);
  }

  onSeleccionarDireccionFact(id: number | null): void {
    this.direccionFactId = id;
    const direccion = this.direccionesFacturacion.find((item) => item.id === id);
    if (direccion) {
      this.rfcFactura = direccion.rfc ?? '';
      this.razonSocialFactura = direccion.razonSocial ?? '';
    }
  }

  alCambiarDireccion(): void {
    this.mensajeError = '';
    this.actualizarCotizacion();
  }

  aplicarDescuento(): void {
    const codigo = this.codigoDescuento.trim();
    if (!codigo) {
      this.mensajeError = 'Ingresa un código de descuento.';
      return;
    }
    this.checkout.validarDescuento(codigo).subscribe({
      next: (descuento) => {
        this.descuentoAplicado = descuento;
        this.mensajeError = '';
        this.actualizarCotizacion();
      },
      error: (error: unknown) => (this.mensajeError = mensajeError(error)),
    });
  }

  actualizarCotizacion(): void {
    if (!this.coberturaValida) {
      this.resumen = null;
      return;
    }
    this.checkout.cotizar(this.datosCotizacion()).subscribe({
      next: (resumen) => {
        this.resumen = resumen;
        this.mensajeError = '';
      },
      error: (error: unknown) => {
        this.resumen = null;
        this.mensajeError = mensajeError(error, 'No fue posible cotizar el pedido.');
      },
    });
  }

  confirmarCompra(): void {
    this.mensajeError = '';
    if (!this.items.length) {
      this.mensajeError = 'No hay artículos para confirmar el pedido.';
      return;
    }
    if (!this.coberturaValida) {
      this.mensajeError = 'Ingresa un código postal de 5 dígitos con cobertura.';
      return;
    }
    if (!this.resumen) {
      this.mensajeError = 'Espera la cotización del pedido antes de pagar.';
      return;
    }
    if (this.direccionSeleccionadaId === 'nueva') {
      const direccion = this.nuevaDireccion;
      if (
        !direccion.destinatario.trim() ||
        !/^\d{10}$/.test(direccion.telefono.trim()) ||
        !direccion.calle.trim() ||
        !direccion.numExt.trim() ||
        !direccion.colonia.trim() ||
        !direccion.municipio.trim() ||
        !direccion.estado.trim()
      ) {
        this.mensajeError =
          'Completa la nueva dirección con un teléfono de 10 dígitos y un C.P. válido.';
        return;
      }
    }
    if (this.requiereFactura) {
      const rfc = this.rfcFactura.trim().toUpperCase();
      if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc) || !this.razonSocialFactura.trim()) {
        this.mensajeError = 'Ingresa un RFC válido de 12 o 13 caracteres y la razón social.';
        return;
      }
    }

    const pago = this.pagoSeleccionado;
    if (!pago) {
      this.mensajeError = 'Selecciona un medio de pago simulado.';
      return;
    }
    if (pago.tipo === 'cuenta' && (pago.saldoDisponible ?? 0) < this.totalPagar) {
      this.mensajeError = 'Saldo insuficiente en la cuenta simulada seleccionada.';
      return;
    }
    if (pago.tipo === 'nueva-tarjeta') {
      const datosTarjeta = this.datosNuevaTarjeta();
      if (
        !/^\d{16}$/.test(datosTarjeta.numero_tarjeta ?? '') ||
        !datosTarjeta.titular?.trim() ||
        !datosTarjeta.vence_mes ||
        !datosTarjeta.vence_anio ||
        !/^\d{3,4}$/.test(datosTarjeta.cvv ?? '')
      ) {
        this.mensajeError = 'Revisa los datos de la tarjeta simulada (número, vigencia y CVV).';
        return;
      }
    }

    const datos: DatosPago = {
      ...this.datosCotizacion(),
      ...(this.direccionSeleccionadaId === 'nueva'
        ? { direccion: this.nuevaDireccionApi() }
        : {}),
      metodo_pago: pago.tipo === 'cuenta' ? 'CUENTA' : 'TARJETA',
      medio_pago_id: pago.tipo === 'nueva-tarjeta' ? null : pago.id,
      notas: null,
    };
    if (pago.tipo === 'nueva-tarjeta') {
      Object.assign(datos, this.datosNuevaTarjeta());
    }

    this.procesando = true;
    this.checkout.pagar(datos).subscribe({
      next: (respuesta) => {
        this.procesando = false;
        this.folioGenerado = respuesta.venta.folio;
        this.totalPagado = Number(respuesta.resumen.total);
        this.resumen = respuesta.resumen;
        this.carrito.limpiar();
        this.pedidoConfirmado.emit({
          folio: respuesta.venta.folio,
          pedidoId: respuesta.pedido.id,
          ventaId: respuesta.venta.id,
          direccionEnvioId: this.direccionSeleccionadaId,
          requiereFactura: this.requiereFactura,
          medioPagoId: pago.tipo === 'nueva-tarjeta' ? null : pago.id,
          totalPagado: this.totalPagado,
        });
      },
      error: (error: unknown) => {
        this.procesando = false;
        this.mensajeError = mensajeError(error, 'El pago no pudo completarse.');
      },
    });
  }

  private datosCotizacion(): DatosCotizacion {
    return {
      ...(this.direccionSeleccionadaId === 'nueva'
        ? { codigo_postal: this.nuevaDireccion.cp }
        : { direccion_id: Number(this.direccionSeleccionadaId) }),
      descuento_codigo: this.codigoDescuento.trim() || null,
      requiere_factura: this.requiereFactura,
      rfc: this.requiereFactura ? this.rfcFactura.trim().toUpperCase() : null,
      razon_social: this.requiereFactura ? this.razonSocialFactura.trim() : null,
      cp_fiscal: this.requiereFactura ? this.cpActivo : null,
    };
  }

  private nuevaDireccionApi(): Record<string, unknown> {
    const direccion = this.nuevaDireccion;
    return {
      tipo: 'ENVIO',
      alias: direccion.alias.trim() || 'Casa',
      destinatario: direccion.destinatario.trim(),
      telefono: direccion.telefono.trim(),
      calle: direccion.calle.trim(),
      numero_ext: direccion.numExt.trim(),
      numero_int: null,
      colonia: direccion.colonia.trim(),
      municipio: direccion.municipio.trim(),
      estado: direccion.estado.trim(),
      codigo_postal: direccion.cp.trim(),
      referencia: null,
      rfc: null,
      razon_social: null,
      predeterminada: false,
    };
  }

  private datosNuevaTarjeta(): Partial<DatosPago> {
    const partes = this.nuevaTarjeta.vencimiento.split('/');
    const mes = Number(partes[0]);
    const anio = Number(partes[1]);
    return {
      numero_tarjeta: this.nuevaTarjeta.numero.replace(/\s/g, ''),
      titular: this.nuevaTarjeta.titular.trim(),
      vence_mes: Number.isFinite(mes) ? mes : null,
      vence_anio: Number.isFinite(anio) ? (anio >= 2000 ? anio : 2000 + anio) : null,
      cvv: this.nuevaTarjeta.cvv.trim(),
    };
  }

  private aOpcionPago(medio: {
    id: number;
    tipo: 'tarjeta' | 'cuenta';
    alias: string;
    marca?: string;
    ultimos4?: string;
    vencimiento?: string;
    saldo?: number;
  }): OpcionPagoCheckout {
    const esCuenta = medio.tipo === 'cuenta';
    return {
      id: medio.id,
      tipo: medio.tipo,
      alias: medio.alias,
      detalle: esCuenta
        ? 'Cuenta simulada'
        : `${medio.marca ?? 'Tarjeta'} •••• ${medio.ultimos4 ?? ''}${
            medio.vencimiento ? ` · Vence ${medio.vencimiento}` : ''
          }`.trim(),
      saldoDisponible: esCuenta ? medio.saldo : undefined,
    };
  }
}
