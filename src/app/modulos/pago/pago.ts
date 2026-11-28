import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { AvisoToast } from '../../compartido/componentes/aviso-toast/aviso-toast';
import {
  codigoPostal5,
  cvv,
  rfcValido,
  tarjetaLuhn,
  telefono10,
  vencimientoFuturo,
} from '../../compartido/validadores/validadores-negocio';
import { codigoError, mensajeError } from '../../core/api/errores';
import { formatearFecha } from '../../core/api/formato';
import { AuthStateService } from '../../core/auth/auth-state.service';
import { AvisosServicio } from '../../nucleo/servicios/avisos-servicio';
import { CarritoServicio } from '../carrito/servicios/carrito-servicio';
import { CuentaServicio } from '../micuenta/servicios/cuenta-servicio';
import type {
  DireccionCliente,
  MedioPagoSimulado,
  PerfilCuenta,
} from '../micuenta/servicios/cuenta-servicio';
import {
  NUEVA_TARJETA_ID,
  PASOS_CHECKOUT,
  VALOR_NUEVA_DIRECCION,
  VALOR_NUEVA_TARJETA,
} from './modelos/checkout';
import type {
  ConfirmacionPedidoCheckout,
  OpcionPagoCheckout,
} from './modelos/checkout';
import {
  CheckoutServicio,
  type DatosCotizacion,
  type DatosPago,
  type DescuentoCheckout,
  type ResumenCheckout,
} from './servicios/checkout-servicio';

// Superficie pública conservada para otras funcionalidades que importaban estos tipos.
export type {
  ConfirmacionPedidoCheckout,
  OpcionDireccionCheckout,
  OpcionPagoCheckout,
  ResumenItemCheckout,
} from './modelos/checkout';
export { NUEVA_TARJETA_ID } from './modelos/checkout';

@Component({
  selector: 'app-pago',
  standalone: true,
  imports: [AvisoToast, CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './pago.html',
  styleUrl: './pago.css',
})
export class Pago {
  private readonly router = inject(Router);
  private readonly carrito = inject(CarritoServicio);
  private readonly cuenta = inject(CuentaServicio);
  private readonly checkout = inject(CheckoutServicio);
  private readonly sesion = inject(AuthStateService);
  private readonly avisos = inject(AvisosServicio);
  private readonly fb = inject(FormBuilder);

  readonly pasos = PASOS_CHECKOUT;
  readonly valorNuevaDireccion = VALOR_NUEVA_DIRECCION;
  readonly valorNuevaTarjeta = VALOR_NUEVA_TARJETA;

  readonly datosForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    correo: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, telefono10]],
  });

  readonly facturacionForm = this.fb.nonNullable.group({
    requiereFactura: [false],
    rfc: ['', [Validators.required, rfcValido]],
    razonSocial: ['', Validators.required],
    cpFiscal: ['', [Validators.required, codigoPostal5]],
  });

  readonly envioForm = this.fb.nonNullable.group({
    direccionId: [VALOR_NUEVA_DIRECCION],
    nuevaDireccion: this.fb.nonNullable.group({
      alias: ['Casa', Validators.required],
      destinatario: ['', Validators.required],
      telefono: ['', [Validators.required, telefono10]],
      calle: ['', Validators.required],
      numExt: ['', Validators.required],
      colonia: ['', Validators.required],
      municipio: ['', Validators.required],
      estado: ['', Validators.required],
      cp: ['', [Validators.required, codigoPostal5]],
    }),
  });

  readonly descuentoForm = this.fb.nonNullable.group({
    codigo: [''],
  });

  readonly pagoForm = this.fb.nonNullable.group({
    medioPagoId: [VALOR_NUEVA_TARJETA],
    nuevaTarjeta: this.fb.nonNullable.group({
      numero: ['', [Validators.required, tarjetaLuhn]],
      titular: ['', Validators.required],
      vencimiento: ['', [Validators.required, vencimientoFuturo]],
      cvv: ['', [Validators.required, cvv]],
    }),
  });

  readonly paso = signal(1);
  readonly maxPaso = signal(1);
  readonly cargando = signal(true);
  readonly revalidando = signal(false);
  readonly aplicando = signal(false);
  readonly procesando = signal(false);
  readonly mensaje = signal('');
  readonly error = signal('');
  readonly perfil = signal<PerfilCuenta | null>(null);
  readonly direccionesEnvio = signal<DireccionCliente[]>([]);
  readonly direccionesFacturacion = signal<DireccionCliente[]>([]);
  readonly mediosPago = signal<OpcionPagoCheckout[]>([]);
  readonly descuento = signal<DescuentoCheckout | null>(null);
  readonly resumen = signal<ResumenCheckout | null>(null);
  readonly confirmacion = signal<ConfirmacionPedidoCheckout | null>(null);

  readonly items = computed(() => this.carrito.resumen().items);
  readonly lineasInvalidas = computed(() =>
    this.items().filter(
      (item) => item.estadoDisponibilidad === 'Agotado' || Boolean(item.cambioDetectado),
    ),
  );

  constructor() {
    this.sincronizarCamposFactura(false);
    this.sincronizarCampoEnvio(VALOR_NUEVA_DIRECCION);
    this.sincronizarCampoPago(VALOR_NUEVA_TARJETA);

    this.facturacionForm.controls.requiereFactura.valueChanges.subscribe((activa) =>
      this.sincronizarCamposFactura(activa),
    );
    this.envioForm.controls.direccionId.valueChanges.subscribe((valor) =>
      this.sincronizarCampoEnvio(valor),
    );
    this.pagoForm.controls.medioPagoId.valueChanges.subscribe((valor) =>
      this.sincronizarCampoPago(valor),
    );

    this.cargar();
  }

  get cpActivo(): string {
    const seleccionada = this.envioForm.controls.direccionId.value;
    if (seleccionada === VALOR_NUEVA_DIRECCION) {
      return this.envioForm.controls.nuevaDireccion.controls.cp.value.trim();
    }
    return (
      this.direccionesEnvio().find((direccion) => String(direccion.id) === seleccionada)?.cp ?? ''
    );
  }

  get coberturaValida(): boolean {
    return /^\d{5}$/.test(this.cpActivo);
  }

  get subtotal(): number {
    return Number(this.resumen()?.subtotal ?? 0);
  }

  get descuentoMonto(): number {
    return Number(this.resumen()?.descuento_monto ?? 0);
  }

  get costoEnvio(): number {
    return Number(this.resumen()?.costo_envio ?? 0);
  }

  get ivaImporte(): number {
    return Number(this.resumen()?.iva_importe ?? 0);
  }

  get total(): number {
    return Number(this.resumen()?.total ?? 0);
  }

  get nombreTarifa(): string {
    const tarifa = this.resumen()?.tarifa;
    return tarifa && typeof tarifa['nombre'] === 'string' ? tarifa['nombre'] : 'Tarifa por definir';
  }

  get diasEntrega(): number | null {
    const tarifa = this.resumen()?.tarifa;
    return tarifa && typeof tarifa['dias_estimados'] === 'number'
      ? tarifa['dias_estimados']
      : null;
  }

  get fechaPromesa(): string {
    return formatearFecha(this.resumen()?.fecha_promesa ?? null);
  }

  get medioSeleccionado(): OpcionPagoCheckout | undefined {
    const id = this.pagoForm.controls.medioPagoId.value;
    return this.mediosPago().find((medio) => String(medio.id) === id);
  }

  protected irAPaso(paso: number): void {
    if (this.confirmacion() || paso < 1 || paso > this.pasos.length) {
      return;
    }
    // Solo se avanza de uno en uno; retroceder siempre es permitido.
    if (paso > this.maxPaso() + 1) {
      return;
    }
    this.maxPaso.update((alcanzado) => Math.max(alcanzado, paso));
    this.paso.set(paso);
    this.error.set('');
  }

  protected anterior(): void {
    if (this.confirmacion() || this.procesando()) return;
    this.irAPaso(this.paso() - 1);
  }

  protected siguiente(): void {
    if (this.procesando()) return;
    this.error.set('');

    switch (this.paso()) {
      case 1:
        if (this.datosForm.invalid) {
          this.datosForm.markAllAsTouched();
          this.error.set('Completa tu nombre, un correo válido y un teléfono de 10 dígitos.');
          return;
        }
        this.irAPaso(2);
        return;
      case 2:
        if (this.facturacionForm.invalid) {
          this.facturacionForm.markAllAsTouched();
          this.error.set('Revisa el RFC, la razón social y el código postal fiscal.');
          return;
        }
        this.irAPaso(3);
        return;
      case 3:
        if (this.envioForm.invalid || !this.coberturaValida) {
          this.envioForm.markAllAsTouched();
          this.error.set('Captura una dirección con código postal de 5 dígitos.');
          return;
        }
        this.cotizarYAvanzar();
        return;
      case 4:
        if (this.items().length === 0) {
          this.error.set('Tu carrito está vacío. Vuelve al catálogo antes de continuar.');
          return;
        }
        if (this.lineasInvalidas().length > 0) {
          this.error.set(
            'Hay líneas agotadas o con cambios de precio. Revisa el carrito antes de continuar.',
          );
          return;
        }
        this.irAPaso(5);
        return;
      case 5:
        this.irAPaso(6);
        return;
      case 6:
        this.confirmarCompra();
        return;
      default:
        return;
    }
  }

  protected aplicarDescuento(): void {
    const codigo = this.descuentoForm.controls.codigo.value.trim();
    if (!codigo) {
      this.error.set('Ingresa un código de descuento para aplicarlo.');
      return;
    }
    this.aplicando.set(true);
    this.error.set('');
    this.checkout
      .validarDescuento(codigo)
      .pipe(finalize(() => this.aplicando.set(false)))
      .subscribe({
        next: (descuento) => {
          this.descuento.set(descuento);
          this.avisos.mostrar('exito', `Descuento «${descuento.codigo}» aplicado.`);
          this.actualizarCotizacion();
        },
        error: (error: unknown) => {
          this.descuento.set(null);
          this.error.set(mensajeError(error, 'El código de descuento no es válido.'));
        },
      });
  }

  protected quitarDescuento(): void {
    this.descuento.set(null);
    this.descuentoForm.controls.codigo.setValue('');
    this.error.set('');
    this.actualizarCotizacion();
  }

  protected alCambiarDireccion(): void {
    this.error.set('');
    this.actualizarCotizacion();
  }

  protected revalidarPaquete(): void {
    this.revalidando.set(true);
    this.carrito
      .cargar()
      .pipe(finalize(() => this.revalidando.set(false)))
      .subscribe({
        next: () => {
          this.mensaje.set('Existencias revalidadas con el servidor. No se reservó mercancía.');
        },
        error: (error: unknown) => {
          this.error.set(mensajeError(error, 'No fue posible revalidar las existencias.'));
        },
      });
  }

  protected confirmarCompra(): void {
    if (this.procesando() || !this.validarTodo()) return;

    const resumen = this.resumen();
    if (!resumen) {
      this.error.set('Espera la cotización del servidor antes de pagar.');
      return;
    }

    const medio = this.medioSeleccionado;
    if (!medio) {
      this.error.set('Selecciona un medio de pago simulado.');
      return;
    }
    if (medio.tipo === 'cuenta' && (medio.saldoDisponible ?? 0) < Number(resumen.total)) {
      this.error.set('Saldo insuficiente en la cuenta simulada seleccionada.');
      return;
    }

    const datos: DatosPago = {
      ...this.datosCotizacion(),
      ...(this.envioForm.controls.direccionId.value === VALOR_NUEVA_DIRECCION
        ? { direccion: this.nuevaDireccionApi() }
        : {}),
      metodo_pago: medio.tipo === 'cuenta' ? 'CUENTA' : 'TARJETA',
      medio_pago_id: medio.tipo === 'nueva-tarjeta' ? null : medio.id,
      notas: null,
    };
    if (medio.tipo === 'nueva-tarjeta') {
      Object.assign(datos, this.datosNuevaTarjeta());
    }

    this.procesando.set(true);
    this.error.set('');
    this.checkout
      .pagar(datos)
      .pipe(
        finalize(() => {
          this.procesando.set(false);
          // El PAN y el CVV nunca se conservan en memoria después del intento.
          this.pagoForm.controls.nuevaTarjeta.reset({
            numero: '',
            titular: '',
            vencimiento: '',
            cvv: '',
          });
        }),
      )
      .subscribe({
        next: (respuesta) => {
          this.resumen.set(respuesta.resumen);
          this.confirmacion.set({
            folio: respuesta.venta.folio,
            pedidoId: respuesta.pedido.id,
            ventaId: respuesta.venta.id,
            direccionEnvioId:
              this.envioForm.controls.direccionId.value === VALOR_NUEVA_DIRECCION
                ? 'nueva'
                : Number(this.envioForm.controls.direccionId.value),
            requiereFactura: this.facturacionForm.controls.requiereFactura.value,
            medioPagoId: medio.tipo === 'nueva-tarjeta' ? null : medio.id,
            totalPagado: Number(respuesta.resumen.total),
          });
          this.carrito.limpiar();
          this.maxPaso.set(this.pasos.length);
          this.paso.set(this.pasos.length);
          this.avisos.mostrar('exito', `Pedido ${respuesta.venta.folio} confirmado.`);
        },
        error: (error: unknown) => {
          this.error.set(
            mensajeError(error, 'El pago fue rechazado. Tu carrito se conserva sin cambios.'),
          );
          this.avisos.mostrar('error', 'No se pudo completar el pago.');
        },
      });
  }

  protected descargarComprobante(): void {
    const confirmacion = this.confirmacion();
    if (!confirmacion) return;

    this.checkout.descargarComprobante(confirmacion.pedidoId).subscribe({
      next: (archivo) => {
        const extension = archivo.type.includes('pdf')
          ? 'pdf'
          : archivo.type.includes('json')
            ? 'json'
            : 'txt';
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `comprobante-${confirmacion.folio}.${extension}`;
        enlace.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.avisos.mostrar('informacion', 'Comprobante digital descargado.');
      },
      error: (error: unknown) => {
        this.error.set(mensajeError(error, 'El comprobante digital no está disponible.'));
        this.avisos.mostrar('error', 'No se pudo descargar el comprobante.');
      },
    });
  }

  protected verMisPedidos(): void {
    void this.router.navigate(['/pedidos']);
  }

  protected volverAlCatalogo(): void {
    void this.router.navigate(['/catalogo']);
  }

  private cargar(): void {
    this.cargando.set(true);
    forkJoin({
      perfil: this.cuenta.perfil().pipe(catchError(() => of(null))),
      direcciones: this.cuenta
        .listarDirecciones()
        .pipe(catchError(() => of([] as DireccionCliente[]))),
      medios: this.cuenta
        .listarMediosPago()
        .pipe(catchError(() => of([] as MedioPagoSimulado[]))),
      carrito: this.carrito.cargar().pipe(catchError(() => of(this.carrito.resumen()))),
    }).subscribe({
      next: ({ perfil, direcciones, medios }) => {
        const usuario = this.sesion.usuario();
        this.perfil.set(perfil);
        this.direccionesEnvio.set(direcciones.filter((direccion) => direccion.tipo === 'envio'));
        this.direccionesFacturacion.set(
          direcciones.filter((direccion) => direccion.tipo === 'facturacion'),
        );

        const nombre = perfil
          ? `${perfil.nombre} ${perfil.apellidos}`.trim()
          : usuario
            ? `${usuario.nombre} ${usuario.apellidos ?? ''}`.trim()
            : '';
        this.datosForm.setValue(
          {
            nombre,
            correo: perfil?.correo ?? usuario?.correo ?? '',
            telefono: perfil?.telefono ?? usuario?.telefono ?? '',
          },
          { emitEvent: false },
        );

        const preferida =
          this.direccionesEnvio().find((direccion) => direccion.predeterminada) ??
          this.direccionesEnvio()[0];
        const valorEnvio = preferida ? String(preferida.id) : VALOR_NUEVA_DIRECCION;
        this.envioForm.controls.direccionId.setValue(valorEnvio, { emitEvent: false });
        this.sincronizarCampoEnvio(valorEnvio);

        const fiscal =
          this.direccionesFacturacion().find((direccion) => direccion.predeterminada) ??
          this.direccionesFacturacion()[0];
        if (fiscal) {
          this.facturacionForm.setValue(
            {
              requiereFactura: true,
              rfc: fiscal.rfc ?? '',
              razonSocial: fiscal.razonSocial ?? '',
              cpFiscal: fiscal.cp,
            },
            { emitEvent: false },
          );
          this.sincronizarCamposFactura(true);
        }

        this.mediosPago.set([
          ...medios.map((medio) => this.aOpcionPago(medio)),
          {
            id: NUEVA_TARJETA_ID,
            tipo: 'nueva-tarjeta',
            alias: 'Nueva tarjeta',
            detalle: 'Captura una tarjeta simulada para esta compra',
          },
        ]);
        const primerMedio = this.mediosPago()[0];
        if (primerMedio) {
          const valorPago = String(primerMedio.id);
          this.pagoForm.controls.medioPagoId.setValue(valorPago, { emitEvent: false });
          this.sincronizarCampoPago(valorPago);
        }

        this.cargando.set(false);
        this.actualizarCotizacion();
        if (!perfil || !direcciones.length || !medios.length) {
          this.mensaje.set(
            'No fue posible cargar todos tus datos guardados. Puedes capturarlos manualmente; Flask validará la información.',
          );
        }
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        this.error.set(mensajeError(error, 'No fue posible preparar el pago.'));
      },
    });
  }

  private cotizarYAvanzar(): void {
    this.revalidando.set(true);
    forkJoin({
      carrito: this.carrito.cargar(),
      cotizacion: this.checkout.cotizar(this.datosCotizacion()),
    })
      .pipe(finalize(() => this.revalidando.set(false)))
      .subscribe({
        next: ({ cotizacion }) => {
          this.resumen.set(cotizacion);
          this.mensaje.set('Existencias revalidadas. La tarifa de envío depende del C.P. capturado.');
          this.irAPaso(4);
        },
        error: (error: unknown) => {
          this.resumen.set(null);
          this.error.set(
            codigoError(error) === 'SIN_COBERTURA'
              ? 'No hay tarifa de envío para ese código postal. Captura otra dirección para continuar.'
              : mensajeError(error, 'No fue posible cotizar el pedido.'),
          );
        },
      });
  }

  private actualizarCotizacion(): void {
    if (!this.coberturaValida) {
      this.resumen.set(null);
      return;
    }
    this.checkout.cotizar(this.datosCotizacion()).subscribe({
      next: (resumen) => {
        this.resumen.set(resumen);
        if (!this.error()) this.mensaje.set('Importes calculados por el servidor.');
      },
      error: (error: unknown) => {
        this.resumen.set(null);
        if (!this.error()) {
          this.error.set(mensajeError(error, 'No fue posible cotizar el pedido.'));
        }
      },
    });
  }

  private validarTodo(): boolean {
    if (this.datosForm.invalid) {
      this.datosForm.markAllAsTouched();
      this.error.set('Revisa tus datos personales antes de pagar.');
      this.paso.set(1);
      return false;
    }
    if (this.facturacionForm.invalid) {
      this.facturacionForm.markAllAsTouched();
      this.error.set('Revisa los datos de facturación antes de pagar.');
      this.paso.set(2);
      return false;
    }
    if (this.envioForm.invalid || !this.coberturaValida) {
      this.envioForm.markAllAsTouched();
      this.error.set('Revisa la dirección de envío y su código postal.');
      this.paso.set(3);
      return false;
    }
    if (this.items().length === 0 || this.lineasInvalidas().length > 0) {
      this.error.set('Revisa las líneas del carrito antes de pagar.');
      this.paso.set(4);
      return false;
    }
    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      this.error.set('Revisa el medio de pago simulado (Luhn, vigencia y CVV).');
      return false;
    }
    return true;
  }

  private sincronizarCamposFactura(activa: boolean): void {
    const controls = [
      this.facturacionForm.controls.rfc,
      this.facturacionForm.controls.razonSocial,
      this.facturacionForm.controls.cpFiscal,
    ];
    for (const control of controls) {
      if (activa) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
  }

  private sincronizarCampoEnvio(valor: string): void {
    if (valor === VALOR_NUEVA_DIRECCION) {
      this.envioForm.controls.nuevaDireccion.enable({ emitEvent: false });
    } else {
      this.envioForm.controls.nuevaDireccion.disable({ emitEvent: false });
    }
    this.resumen.set(null);
  }

  private sincronizarCampoPago(valor: string): void {
    if (valor === VALOR_NUEVA_TARJETA) {
      this.pagoForm.controls.nuevaTarjeta.enable({ emitEvent: false });
    } else {
      this.pagoForm.controls.nuevaTarjeta.disable({ emitEvent: false });
    }
  }

  private datosCotizacion(): DatosCotizacion {
    const destino = this.envioForm.controls.direccionId.value;
    const factura = this.facturacionForm.controls.requiereFactura.value;
    return {
      ...(destino === VALOR_NUEVA_DIRECCION
        ? { codigo_postal: this.envioForm.controls.nuevaDireccion.controls.cp.value.trim() }
        : { direccion_id: Number(destino) }),
      descuento_codigo: this.descuento()?.codigo ?? null,
      requiere_factura: factura,
      rfc: factura ? this.facturacionForm.controls.rfc.value.trim().toUpperCase() : null,
      razon_social: factura ? this.facturacionForm.controls.razonSocial.value.trim() : null,
      cp_fiscal: factura ? this.facturacionForm.controls.cpFiscal.value.trim() : null,
    };
  }

  private nuevaDireccionApi(): Record<string, unknown> {
    const direccion = this.envioForm.controls.nuevaDireccion.getRawValue();
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
    const tarjeta = this.pagoForm.controls.nuevaTarjeta.getRawValue();
    const partes = tarjeta.vencimiento.split('/');
    const mes = Number(partes[0]);
    let anio = Number(partes[1]);
    if (Number.isFinite(anio) && anio < 100) anio += 2000;
    return {
      numero_tarjeta: tarjeta.numero.replace(/\D/g, ''),
      titular: tarjeta.titular.trim(),
      vence_mes: Number.isFinite(mes) ? mes : null,
      vence_anio: Number.isFinite(anio) ? anio : null,
      cvv: tarjeta.cvv.trim(),
    };
  }

  private aOpcionPago(medio: MedioPagoSimulado): OpcionPagoCheckout {
    const esCuenta = medio.tipo === 'cuenta';
    return {
      id: medio.id,
      tipo: medio.tipo,
      alias: medio.alias,
      detalle: esCuenta
        ? `Cuenta simulada · saldo ${new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
          }).format(medio.saldo ?? 0)}`
        : `${medio.marca ?? 'Tarjeta'} •••• ${medio.ultimos4 ?? ''}${
            medio.vencimiento ? ` · Vence ${medio.vencimiento}` : ''
          }`.trim(),
      saldoDisponible: esCuenta ? medio.saldo : undefined,
    };
  }
}
