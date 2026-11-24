import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ResumenItemCheckout {
  idLinea: string;
  nombre: string;
  sku: string;
  colorNombre: string;
  talla: string;
  cantidad: number;
  precioUnitarioConIva: number;
}

export interface OpcionDireccionCheckout {
  id: number;
  tipo: 'envio' | 'facturacion';
  alias: string;
  destinatario: string;
  calle: string;
  numExt: string;
  colonia: string;
  municipio: string;
  estado: string;
  cp: string;
  predeterminada: boolean;
  rfc?: string;
  razonSocial?: string;
}

export interface OpcionPagoCheckout {
  id: number;
  tipo: 'tarjeta' | 'cuenta';
  alias: string;
  detalle: string;
  saldoDisponible?: number;
}

export interface ConfirmacionPedidoCheckout {
  folio: string;
  direccionEnvioId: number | 'nueva';
  metodoEnvio: 'estandar' | 'expres';
  requiereFactura: boolean;
  medioPagoId: number;
  totalPagado: number;
}

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pago.html',
  styles: []
})
export class Pago implements OnInit {
  @Input() items: ResumenItemCheckout[] = [
    {
      idLinea: '101',
      nombre: 'Sudadera Lila Oversize',
      sku: 'UNQ-SUD-LIL-CH',
      colorNombre: 'Lila',
      talla: 'CH',
      cantidad: 1,
      precioUnitarioConIva: 549
    }
  ];

  @Input() direccionesEnvio: OpcionDireccionCheckout[] = [
    {
      id: 1,
      tipo: 'envio',
      alias: 'Casa',
      destinatario: 'Cliente Demo',
      calle: 'Blvd. Universidad Tecnológica',
      numExt: '225',
      colonia: 'San Carlos',
      municipio: 'León',
      estado: 'Guanajuato',
      cp: '37670',
      predeterminada: true
    }
  ];

  @Input() direccionesFacturacion: OpcionDireccionCheckout[] = [
    {
      id: 2,
      tipo: 'facturacion',
      alias: 'Datos fiscales',
      destinatario: 'Cliente Demo',
      calle: 'Blvd. Universidad Tecnológica',
      numExt: '225',
      colonia: 'San Carlos',
      municipio: 'León',
      estado: 'Guanajuato',
      cp: '37670',
      predeterminada: true,
      rfc: 'XAXX010101000',
      razonSocial: 'Cliente Demo'
    }
  ];

  @Input() mediosPago: OpcionPagoCheckout[] = [
    {
      id: 1,
      tipo: 'tarjeta',
      alias: 'Tarjeta principal',
      detalle: 'Visa •••• 4242 · Vence 08/29'
    },
    {
      id: 2,
      tipo: 'cuenta',
      alias: 'Monedero UNIQUE',
      detalle: 'Cuenta simulada',
      saldoDisponible: 1500
    }
  ];

  @Output() volverAlCarrito = new EventEmitter<void>();
  @Output() cerrar = new EventEmitter<void>();
  @Output() pedidoConfirmado = new EventEmitter<ConfirmacionPedidoCheckout>();

  direccionSeleccionadaId: number | 'nueva' = 'nueva';
  nuevaDireccion = {
    alias: '',
    destinatario: '',
    calle: '',
    numExt: '',
    colonia: '',
    municipio: '',
    estado: '',
    cp: ''
  };

  metodoEnvio: 'estandar' | 'expres' = 'estandar';
  requiereFactura = false;
  direccionFactId: number | null = null;
  rfcFactura = '';
  razonSocialFactura = '';

  medioPagoSeleccionadoId: number | null = null;
  mensajeError = '';
  folioGenerado = '';

  ngOnInit(): void {
    const predetEnvio = this.direccionesEnvio.find((d) => d.predeterminada) || this.direccionesEnvio[0];
    this.direccionSeleccionadaId = predetEnvio ? predetEnvio.id : 'nueva';

    const predetFact =
      this.direccionesFacturacion.find((d) => d.predeterminada) || this.direccionesFacturacion[0];
    if (predetFact) {
      this.direccionFactId = predetFact.id;
      this.rfcFactura = predetFact.rfc || '';
      this.razonSocialFactura = predetFact.razonSocial || '';
    }

    if (this.mediosPago.length > 0) {
      this.medioPagoSeleccionadoId = this.mediosPago[0].id;
    }
  }

  get subtotalConIva(): number {
    return this.items.reduce((acc, item) => acc + item.precioUnitarioConIva * item.cantidad, 0);
  }

  get costoEnvio(): number {
    if (this.items.length === 0) return 0;
    if (this.metodoEnvio === 'expres') return 149;
    return this.subtotalConIva >= 900 ? 0 : 99;
  }

  get totalPagar(): number {
    return this.subtotalConIva + this.costoEnvio;
  }

  get cpActivo(): string {
    if (this.direccionSeleccionadaId === 'nueva') {
      return this.nuevaDireccion.cp;
    }
    const encontrada = this.direccionesEnvio.find((d) => d.id === this.direccionSeleccionadaId);
    return encontrada ? encontrada.cp : '';
  }

  get coberturaValida(): boolean {
    return /^\d{5}$/.test(this.cpActivo);
  }

  get pagoSeleccionado(): OpcionPagoCheckout | undefined {
    return this.mediosPago.find((m) => m.id === this.medioPagoSeleccionadoId);
  }

  onSeleccionarDireccionFact(id: number | null): void {
    this.direccionFactId = id;
    const dir = this.direccionesFacturacion.find((d) => d.id === id);
    if (dir) {
      this.rfcFactura = dir.rfc || '';
      this.razonSocialFactura = dir.razonSocial || '';
    }
  }

  confirmarCompra(): void {
    this.mensajeError = '';

    if (!this.items.length) {
      this.mensajeError = 'No hay artículos para confirmar el pedido.';
      return;
    }

    if (this.direccionSeleccionadaId === 'nueva') {
      if (
        !this.nuevaDireccion.destinatario.trim() ||
        !this.nuevaDireccion.calle.trim() ||
        !this.nuevaDireccion.numExt.trim() ||
        !this.nuevaDireccion.colonia.trim() ||
        !this.nuevaDireccion.municipio.trim() ||
        !this.nuevaDireccion.estado.trim() ||
        !this.coberturaValida
      ) {
        this.mensajeError = 'Completa los campos de la nueva dirección y un código postal válido de 5 dígitos.';
        return;
      }
    } else if (!this.coberturaValida) {
      this.mensajeError = 'La dirección seleccionada no cuenta con código postal válido de 5 dígitos.';
      return;
    }

    if (this.requiereFactura) {
      const rfcLimpio = this.rfcFactura.trim().toUpperCase();
      if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfcLimpio) || !this.razonSocialFactura.trim()) {
        this.mensajeError = 'Para facturar ingresa un RFC válido (12 o 13 caracteres) y la razón social.';
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

    const folio = `UNQ-${Date.now().toString().slice(-6)}`;
    this.folioGenerado = folio;

    this.pedidoConfirmado.emit({
      folio,
      direccionEnvioId: this.direccionSeleccionadaId,
      metodoEnvio: this.metodoEnvio,
      requiereFactura: this.requiereFactura,
      medioPagoId: pago.id,
      totalPagado: this.totalPagar
    });
  }
}