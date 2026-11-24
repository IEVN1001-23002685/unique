import { Component, computed, inject, signal, type WritableSignal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  codigoPostal5,
  rfcValido,
  telefono10,
} from '../../../../compartido/validadores/validadores-negocio';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { CLIENTES_SIMULADOS } from '../../datos-simulados/clientes';
import { VARIANTES_SIMULADAS } from '../../datos-simulados/variantes';
import { NavegacionVentas } from '../../componentes/navegacion-ventas/navegacion-ventas';
import { VentasServicio } from '../../servicios/ventas-servicio';
import type {
  ClienteVenta,
  ContextoDescuento,
  Descuento,
  DireccionVenta,
  MetodoPago,
} from '../../modelos/venta';

interface LineaCarrito {
  sku: string;
  cantidad: number;
  nombreProducto: string;
  talla: string;
  color: string;
  precioUnitario: number;
  subtotal: number;
}

@Component({
  selector: 'app-venta-manual',
  imports: [CurrencyPipe, ReactiveFormsModule, NavegacionVentas],
  templateUrl: './venta-manual.html',
  styleUrl: './venta-manual.css',
})
export class VentaManual {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosServicio);
  protected readonly servicio = inject(VentasServicio);

  protected readonly clientes = CLIENTES_SIMULADOS;
  protected readonly variantes = VARIANTES_SIMULADAS;
  protected readonly metodosPago: { valor: MetodoPago; etiqueta: string }[] = [
    { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
    { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
    { valor: 'TARJETA', etiqueta: 'Tarjeta simulada' },
  ];

  protected readonly paso = signal(1);
  protected readonly intentoPaso = signal(false);
  protected readonly codigoPostal = signal('');
  protected readonly requiereFactura = signal(false);
  protected readonly esPrimeraCompra = signal(false);
  protected readonly descuentoAplicado = signal<Descuento | null>(null);
  protected readonly lineasCarrito = signal<LineaCarrito[]>([]);

  protected readonly lineas = this.fb.nonNullable.array([
    this.fb.nonNullable.group({ sku: [''], cantidad: [1] }),
  ]);

  protected readonly formulario = this.fb.nonNullable.group({
    lineas: this.lineas,
    clienteTipo: ['EXISTENTE'],
    clienteId: [0],
    nombreNuevo: [''],
    correoNuevo: [''],
    telefonoNuevo: [''],
    destinatario: [''],
    telefono: [''],
    calle: [''],
    numeroExt: [''],
    numeroInt: [''],
    colonia: [''],
    municipio: ['León', [Validators.required]],
    estado: ['Guanajuato', [Validators.required]],
    codigoPostal: ['', [Validators.required, codigoPostal5]],
    referencia: [''],
    requiereFactura: [false],
    rfc: [''],
    razonSocial: [''],
    codigoCupon: [''],
    esPrimeraCompra: [false],
    metodoPago: ['TRANSFERENCIA' as MetodoPago, [Validators.required]],
    ultimos4: [''],
    estadoPago: ['PENDIENTE' as 'PAGADA' | 'PENDIENTE', [Validators.required]],
  });

  protected readonly subtotal = computed(() =>
    this.lineasCarrito().reduce((suma, linea) => suma + linea.subtotal, 0),
  );

  protected readonly articulos = computed(() =>
    this.lineasCarrito().reduce((suma, linea) => suma + linea.cantidad, 0),
  );

  protected readonly tarifa = computed(() =>
    this.servicio.tarifaPorCodigoPostal(this.codigoPostal()),
  );

  protected readonly costoEnvio = computed(() => this.tarifa()?.costo ?? 0);

  protected readonly descuentoMonto = computed(() => {
    const descuento = this.descuentoAplicado();
    if (descuento === null) {
      return 0;
    }
    return this.servicio.validarDescuento(descuento, this.contexto()).monto;
  });

  protected readonly total = computed(() =>
    Math.max(0, this.subtotal() - this.descuentoMonto() + this.costoEnvio()),
  );

  protected readonly lineasInvalidas = computed(() => {
    const actuales = this.lineasCarrito();
    if (actuales.length === 0) {
      return true;
    }
    if (
      actuales.some(
        (linea) =>
          linea.sku.trim() === '' ||
          linea.precioUnitario <= 0 ||
          !Number.isInteger(linea.cantidad) ||
          linea.cantidad < 1,
      )
    ) {
      return true;
    }
    const skus = actuales.map((linea) => linea.sku);
    return new Set(skus).size !== skus.length;
  });

  constructor() {
    this.sincronizarLineas();
  }

  protected esInvalido(campo: string): boolean {
    const control = this.formulario.get(campo);
    return control !== null && control.invalid && (control.touched || this.intentoPaso());
  }

  protected telefonoInvalido(campo: 'telefonoNuevo' | 'telefono'): boolean {
    const control = this.formulario.get(campo);
    return control !== null && control.value.trim() !== '' && telefono10(control) !== null;
  }

  protected esRfcInvalido(): boolean {
    const control = this.formulario.controls.rfc;
    return control.value.trim() !== '' && rfcValido(control) !== null;
  }

  protected alCambiarCp(evento: Event): void {
    this.codigoPostal.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarCheckbox(evento: Event, destino: WritableSignal<boolean>): void {
    destino.set((evento.target as HTMLInputElement).checked);
  }

  protected agregarLinea(): void {
    this.lineas.push(this.fb.nonNullable.group({ sku: [''], cantidad: [1] }));
    this.sincronizarLineas();
  }

  protected quitarLinea(indice: number): void {
    if (this.lineas.length > 1) {
      this.lineas.removeAt(indice);
    } else {
      this.lineas.at(0)?.setValue({ sku: '', cantidad: 1 });
    }
    this.sincronizarLineas();
  }

  protected aplicarCupon(): void {
    const codigo = this.formulario.controls.codigoCupon.value.trim();
    if (codigo === '') {
      this.avisos.mostrar('error', 'Captura el código del cupón para aplicarlo.');
      return;
    }

    const descuento = this.servicio.buscarCupon(codigo);
    if (!descuento) {
      this.avisos.mostrar('error', 'El cupón no existe, está inactivo o no aplica.');
      return;
    }

    const validacion = this.servicio.validarDescuento(descuento, this.contexto());
    if (!validacion.valido) {
      this.avisos.mostrar('error', validacion.motivo);
      return;
    }

    this.descuentoAplicado.set(descuento);
    this.avisos.mostrar(
      'exito',
      `Cupón «${descuento.nombre}» aplicado. Solo se permite uno por venta.`,
    );
  }

  protected aplicarAutomatico(): void {
    const descuento = this.servicio.descuentoAutomatico(this.contexto());
    if (!descuento) {
      this.avisos.mostrar(
        'advertencia',
        'No hay un descuento automático vigente para estos datos. Revisa «primera compra», mínimos y vigencia.',
      );
      return;
    }

    this.descuentoAplicado.set(descuento);
    this.avisos.mostrar('exito', `Descuento automático «${descuento.nombre}» aplicado.`);
  }

  protected quitarDescuento(): void {
    this.descuentoAplicado.set(null);
    this.formulario.controls.codigoCupon.setValue('');
  }

  protected avanzar(): void {
    if (!this.validarPaso(this.paso())) {
      this.intentoPaso.set(true);
      this.avisos.mostrar('error', `Revisa los campos del paso ${this.paso()} antes de continuar.`);
      return;
    }

    this.intentoPaso.set(false);
    this.paso.update((actual) => Math.min(4, actual + 1));
  }

  protected retroceder(): void {
    this.intentoPaso.set(false);
    this.paso.update((actual) => Math.max(1, actual - 1));
  }

  protected finalizar(): void {
    // Evita que Enter en un campo de los pasos 1-3 envíe el formulario completo.
    if (this.paso() !== 4) {
      this.avanzar();
      return;
    }

    if (!this.validarPaso(4)) {
      this.intentoPaso.set(true);
      return;
    }

    const valor = this.formulario.getRawValue();
    const existente =
      valor.clienteTipo === 'EXISTENTE'
        ? CLIENTES_SIMULADOS.find((cliente) => cliente.id === valor.clienteId)
        : undefined;

    if (valor.clienteTipo === 'EXISTENTE' && !existente) {
      this.avisos.mostrar('error', 'Selecciona un cliente existente válido.');
      return;
    }

    const cliente: ClienteVenta = existente ?? {
      id: 0,
      nombre: valor.nombreNuevo.trim(),
      correo: valor.correoNuevo.trim(),
      telefono: valor.telefonoNuevo.trim(),
      esNuevoSinAcceso: true,
    };

    const envio: DireccionVenta = {
      tipo: 'ENVIO',
      destinatario: valor.destinatario.trim(),
      telefono: valor.telefono.trim(),
      calle: valor.calle.trim(),
      numeroExt: valor.numeroExt.trim(),
      numeroInt: valor.numeroInt.trim() === '' ? null : valor.numeroInt.trim(),
      colonia: valor.colonia.trim(),
      municipio: valor.municipio.trim(),
      estado: valor.estado.trim(),
      codigoPostal: valor.codigoPostal.trim(),
      referencia: valor.referencia.trim() === '' ? null : valor.referencia.trim(),
      rfc: null,
      razonSocial: null,
    };

    const facturacion: DireccionVenta = {
      ...envio,
      tipo: 'FACTURACION',
      rfc: this.requiereFactura() ? valor.rfc.trim().toUpperCase() : null,
      razonSocial: this.requiereFactura() ? valor.razonSocial.trim() : null,
    };

    const ultimos4 =
      valor.metodoPago === 'TARJETA' && valor.ultimos4.trim() !== '' ? valor.ultimos4.trim() : null;

    const venta = this.servicio.crearVentaManual({
      cliente,
      lineas: this.lineas.getRawValue().map((linea) => ({
        sku: linea.sku,
        cantidad: linea.cantidad,
      })),
      direccionEnvio: envio,
      direccionFacturacion: facturacion,
      descuentoId: this.descuentoAplicado()?.id ?? null,
      metodoPago: valor.metodoPago,
      estadoPago: valor.estadoPago,
      ultimos4,
      titular: cliente.nombre,
      costoEnvio: this.costoEnvio(),
    });

    const avisoReserva =
      venta.estadoPago === 'PENDIENTE'
        ? ' La reserva de existencias y la alerta de pago pendiente dependen de M12 y M21.'
        : '';

    this.avisos.mostrar(
      'exito',
      `Venta ${venta.folio} registrada solo en memoria.${avisoReserva} Persistencia pendiente de Flask.`,
    );
    this.router.navigate(['/ventas', venta.folio]);
  }

  private contexto(): ContextoDescuento {
    return {
      subtotal: this.subtotal(),
      cantidadArticulos: this.articulos(),
      esPrimeraCompra: this.esPrimeraCompra(),
    };
  }

  protected sincronizarLineas(): void {
    this.lineasCarrito.set(
      this.lineas.getRawValue().map(({ sku, cantidad }) => {
        const variante = VARIANTES_SIMULADAS.find((item) => item.sku === sku);
        return {
          sku,
          cantidad,
          nombreProducto: variante?.nombreProducto ?? 'SKU no válido',
          talla: variante?.talla ?? '—',
          color: variante?.color ?? '—',
          precioUnitario: variante?.precioUnitario ?? 0,
          subtotal: (variante?.precioUnitario ?? 0) * cantidad,
        };
      }),
    );
  }

  private validarPaso(paso: number): boolean {
    const valor = this.formulario.getRawValue();

    if (paso === 1) {
      if (valor.clienteTipo === 'EXISTENTE') {
        return valor.clienteId > 0;
      }
      const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.correoNuevo.trim());
      return (
        valor.nombreNuevo.trim() !== '' &&
        correoValido &&
        valor.telefonoNuevo.trim() !== '' &&
        telefono10(this.formulario.controls.telefonoNuevo) === null
      );
    }

    if (paso === 2) {
      return !this.lineasInvalidas();
    }

    if (paso === 3) {
      const datosBasicos =
        valor.destinatario.trim() !== '' &&
        valor.telefono.trim() !== '' &&
        telefono10(this.formulario.controls.telefono) === null &&
        valor.calle.trim() !== '' &&
        valor.numeroExt.trim() !== '' &&
        valor.colonia.trim() !== '' &&
        valor.municipio.trim() !== '' &&
        valor.estado.trim() !== '' &&
        this.formulario.controls.codigoPostal.valid &&
        this.tarifa() !== null;

      if (!datosBasicos) {
        return false;
      }

      return (
        !this.requiereFactura() ||
        (valor.razonSocial.trim() !== '' &&
          valor.rfc.trim() !== '' &&
          rfcValido(this.formulario.controls.rfc) === null)
      );
    }

    if (valor.metodoPago === 'TARJETA' && valor.ultimos4.trim() !== '') {
      return /^\d{4}$/.test(valor.ultimos4.trim());
    }
    return true;
  }
}
