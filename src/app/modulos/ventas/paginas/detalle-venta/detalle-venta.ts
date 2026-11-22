import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { ChipEstadoVenta } from '../../componentes/chip-estado-venta/chip-estado-venta';
import { NavegacionVentas } from '../../componentes/navegacion-ventas/navegacion-ventas';
import {
  ModalAccionVenta,
  type ResultadoAccionVenta,
} from '../../componentes/modal-accion-venta/modal-accion-venta';
import { VentasServicio } from '../../servicios/ventas-servicio';
import type { LineaVenta, MetodoPago } from '../../modelos/venta';

interface AccionVenta {
  tipo: 'cancelar' | 'reembolsar';
  titulo: string;
  mensaje: string;
  etiqueta: string;
  pedirMonto: boolean;
  montoMaximo: number;
}

@Component({
  selector: 'app-detalle-venta',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    ChipEstadoVenta,
    NavegacionVentas,
    ModalConfirmacion,
    ModalAccionVenta,
  ],
  templateUrl: './detalle-venta.html',
  styleUrl: './detalle-venta.css',
})
export class DetalleVenta {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly servicio = inject(VentasServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly folio = this.ruta.snapshot.paramMap.get('folio') ?? '';
  protected readonly venta = computed(() => this.servicio.obtenerVenta(this.folio));
  protected readonly pagoAbierto = signal(false);
  protected readonly validarPagoAbierto = signal(false);
  protected readonly accion = signal<AccionVenta | null>(null);
  protected readonly intentoPago = signal(false);

  protected readonly formaPago = this.fb.nonNullable.group({
    monto: [0, [Validators.required, Validators.min(0.01)]],
    metodo: ['TRANSFERENCIA' as MetodoPago, [Validators.required]],
    ultimos4: [''],
    estado: ['APROBADO' as 'APROBADO' | 'PENDIENTE', [Validators.required]],
  });

  protected readonly direccionEnvio = computed(() =>
    this.venta()?.direcciones.find((direccion) => direccion.tipo === 'ENVIO'),
  );

  protected readonly direccionFacturacion = computed(() =>
    this.venta()?.direcciones.find((direccion) => direccion.tipo === 'FACTURACION'),
  );

  protected readonly tieneCobroAprobado = computed(
    () =>
      this.venta()?.pagos.some((pago) => pago.tipo === 'COBRO' && pago.estado === 'APROBADO') ??
      false,
  );

  protected esInvalido(campo: string): boolean {
    const control = this.formaPago.get(campo);
    return control !== null && control.invalid && (control.touched || this.intentoPago());
  }

  /** Margen sobre precio sin IVA, según la fórmula documentada en M20. */
  protected margen(linea: LineaVenta): number {
    const precioSinIva = linea.precioUnitario / 1.16;
    if (precioSinIva <= 0) {
      return 0;
    }
    return ((precioSinIva - linea.costoEstandarUnitario) / precioSinIva) * 100;
  }

  protected abrirPago(): void {
    const venta = this.venta();
    if (!venta) {
      return;
    }
    this.formaPago.setValue({
      monto: Math.max(0, Math.round((venta.total - this.cobrado()) * 100) / 100),
      metodo: 'TRANSFERENCIA',
      ultimos4: '',
      estado: 'APROBADO',
    });
    this.intentoPago.set(false);
    this.pagoAbierto.set(true);
  }

  protected registrarPago(): void {
    this.intentoPago.set(true);
    if (this.formaPago.invalid) {
      this.formaPago.markAllAsTouched();
      return;
    }

    const valor = this.formaPago.getRawValue();
    const ultimos4 = valor.ultimos4.trim();
    if (valor.metodo === 'TARJETA' && ultimos4 !== '' && !/^\d{4}$/.test(ultimos4)) {
      this.avisos.mostrar('error', 'Captura únicamente los últimos 4 dígitos, sin PAN ni CVV.');
      return;
    }

    const pago = this.servicio.registrarPago(this.folio, {
      monto: valor.monto,
      metodo: valor.metodo,
      ultimos4: ultimos4 === '' ? null : ultimos4,
      estado: valor.estado,
    });

    if (!pago) {
      this.avisos.mostrar('error', 'No fue posible registrar el pago en la venta de demostración.');
      return;
    }

    this.pagoAbierto.set(false);
    this.avisos.mostrar(
      'exito',
      `Pago ${pago.referencia} registrado solo en memoria. Validación real pendiente de Flask.`,
    );
  }

  protected confirmarValidarPago(): void {
    const ok = this.servicio.validarPago(this.folio);
    this.validarPagoAbierto.set(false);
    this.avisos.mostrar(
      ok ? 'exito' : 'advertencia',
      ok
        ? 'Pago validado en la vista de demostración. El cambio no persiste en servidor.'
        : 'No hay un pago pendiente que validar en esta venta.',
    );
  }

  protected abrirCancelacion(): void {
    this.accion.set({
      tipo: 'cancelar',
      titulo: 'Cancelar venta',
      mensaje:
        'La venta y su pedido pasarán a CANCELADO. Si hubo cobro, se genera un reembolso simulado. Las reservas reales se liberan en M12.',
      etiqueta: 'Cancelar venta',
      pedirMonto: false,
      montoMaximo: 0,
    });
  }

  protected abrirReembolso(): void {
    this.accion.set({
      tipo: 'reembolsar',
      titulo: 'Registrar reembolso',
      mensaje:
        'Se registrará un reembolso simulado con referencia SIM. No se envía dinero ni se notifica a un banco.',
      etiqueta: 'Reembolsar',
      pedirMonto: true,
      montoMaximo: this.venta()?.total ?? 0,
    });
  }

  protected confirmarAccion(resultado: ResultadoAccionVenta): void {
    const accion = this.accion();
    if (!accion) {
      return;
    }

    if (accion.tipo === 'cancelar') {
      const ok = this.servicio.cancelarVenta(this.folio, resultado.motivo);
      this.avisos.mostrar(
        ok ? 'advertencia' : 'error',
        ok
          ? 'Venta cancelada en memoria. Cancelación del pedido y liberación de reservas pendientes de M09/M12.'
          : 'No fue posible cancelar esta venta de demostración.',
      );
    } else {
      const ok = this.servicio.reembolsar(this.folio, resultado.monto, resultado.motivo);
      this.avisos.mostrar(
        ok ? 'exito' : 'error',
        ok
          ? 'Reembolso simulado registrado en memoria; sin movimiento bancario real.'
          : 'Revisa el monto del reembolso.',
      );
    }

    this.accion.set(null);
  }

  protected avisoPedidoPendiente(): void {
    this.avisos.mostrar(
      'informacion',
      'El detalle del pedido pertenece a M09 y aún no está implementado. Esta venta conserva su folio de pedido para la integración.',
    );
  }

  protected descargarComprobante(): void {
    const venta = this.venta();
    if (!venta) {
      return;
    }

    const texto = [
      'COMPROBANTE DIGITAL SIMULADO — UNIQUE',
      'Sin timbrado ni valor fiscal.',
      '',
      `Folio de venta: ${venta.folio}`,
      `Cliente: ${venta.cliente}`,
      `Fecha: ${venta.fecha.replace('T', ' ')}`,
      `Canal: ${venta.canal}`,
      `Subtotal: $${venta.subtotal.toFixed(2)} MXN`,
      `Descuento: $${venta.descuentoMonto.toFixed(2)} MXN`,
      `Envío: $${venta.costoEnvio.toFixed(2)} MXN`,
      `Total: $${venta.total.toFixed(2)} MXN`,
      `IVA informativo incluido: $${venta.ivaIncluido.toFixed(2)} MXN`,
      '',
      'Ejemplar de demostración generado por el frontend.',
    ].join('\n');

    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8;' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `comprobante-${venta.folio}.txt`;
    enlace.click();
    URL.revokeObjectURL(url);

    this.avisos.mostrar(
      'informacion',
      'Comprobante simulado descargado. No constituye una factura ni fue timbrado.',
    );
  }

  private cobrado(): number {
    return (
      this.venta()
        ?.pagos.filter((pago) => pago.tipo === 'COBRO' && pago.estado === 'APROBADO')
        .reduce((suma, pago) => suma + pago.monto, 0) ?? 0
    );
  }
}
