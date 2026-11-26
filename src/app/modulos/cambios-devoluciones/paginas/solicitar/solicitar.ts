import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { cantidadEntera } from '../../../../compartido/validadores/validadores-negocio';
import { mensajeError } from '../../../../core/api/errores';
import { formatearFechaHora } from '../../../../core/api/formato';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import type { PedidoCliente } from '../../../mispedidos/servicios/mis-pedidos-servicio';
import {
  MOTIVOS_SOLICITUD,
  TIPOS_SOLICITUD,
  etiquetaColor,
  etiquetaMotivo,
  etiquetaTalla,
  estimarReembolso,
  type MotivoSolicitud,
  type TipoSolicitudCaso,
  type VarianteCatalogo,
} from '../../modelos/cambio-devolucion';
import { DevolucionesServicio } from '../../servicios/devoluciones-servicio';

interface LineaForm {
  ventaLineaId: FormControl<number>;
  productoId: FormControl<number>;
  sku: FormControl<string>;
  descripcion: FormControl<string>;
  cantidadComprada: FormControl<number>;
  cantidadDevuelta: FormControl<number>;
  cantidadSolicitada: FormControl<number>;
  precioUnitarioConIva: FormControl<number>;
  subtotalConIva: FormControl<number>;
  varianteCambioId: FormControl<number | null>;
}

interface ArchivoEvidencia {
  archivo: File;
  vistaPrevia: string;
}

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO = 2 * 1024 * 1024;
const MAXIMO_EVIDENCIAS = 3;

/** Solicitud del cliente: pedido entregado, líneas, motivos y evidencias (§7 M07). */
@Component({
  selector: 'app-cd-solicitar',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './solicitar.html',
  styleUrls: ['./solicitar.css', '../../cambios-devoluciones-compartido.css'],
})
export class Solicitar {
  readonly pedidoInicial = input(0);
  readonly folioInicial = input<string | null>(null);
  readonly enviada = output<string>();

  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(DevolucionesServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly destroyRef = inject(DestroyRef);

  readonly tipos = TIPOS_SOLICITUD;
  readonly motivos = MOTIVOS_SOLICITUD;
  readonly etiquetaMotivo = etiquetaMotivo;
  readonly etiquetaColor = etiquetaColor;
  readonly etiquetaTalla = etiquetaTalla;
  readonly formatearFechaHora = formatearFechaHora;

  readonly form = this.fb.nonNullable.group({
    pedidoId: [0, Validators.required],
    tipo: ['DEVOLUCION' as TipoSolicitudCaso, Validators.required],
    motivo: ['DEFECTO' as MotivoSolicitud, Validators.required],
    descripcion: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]],
    lineas: this.fb.array<FormGroup<LineaForm>>([]),
  });

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly pedidos = signal<PedidoCliente[]>([]);
  readonly opcionesVariante = signal<Record<number, VarianteCatalogo[]>>({});
  readonly evidencias = signal<ArchivoEvidencia[]>([]);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly cargandoVariantes = signal(false);
  readonly error = signal('');

  readonly pedido = computed(
    () => this.pedidos().find((item) => item.id === this.form.controls.pedidoId.value) ?? null,
  );

  readonly estimacion = computed(() => {
    const valores = this.valores();
    const pedido = this.pedido();
    return estimarReembolso({
      motivo: valores.motivo ?? 'DEFECTO',
      subtotalPedido: pedido?.subtotal ?? 0,
      descuentoPedido: pedido?.descuento ?? 0,
      envioPedido: pedido?.envio ?? 0,
      lineas: (valores.lineas ?? []).map((linea) => ({
        precioUnitarioConIva: linea.precioUnitarioConIva ?? 0,
        cantidad: linea.cantidadSolicitada ?? 0,
      })),
    });
  });

  constructor() {
    this.cargarPedidos();
    this.destroyRef.onDestroy(() => this.liberarEvidencias());
  }

  protected get lineasForm(): FormGroup<LineaForm>[] {
    return this.form.controls.lineas.controls;
  }

  protected maximo(linea: FormGroup<LineaForm>): number {
    return Math.max(
      0,
      linea.controls.cantidadComprada.value - linea.controls.cantidadDevuelta.value,
    );
  }

  protected opciones(linea: FormGroup<LineaForm>): VarianteCatalogo[] {
    return this.opcionesVariante()[linea.controls.productoId.value] ?? [];
  }

  protected cantidadInvalida(linea: FormGroup<LineaForm>): boolean {
    const control = linea.controls.cantidadSolicitada;
    return control.invalid && (control.dirty || control.touched);
  }

  protected seleccionarPedido(id: number): void {
    this.error.set('');
    this.form.controls.pedidoId.setValue(id);
    this.form.controls.lineas.clear();
    this.opcionesVariante.set({});
    if (!id) return;

    this.servicio
      .detallePedido(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          const lineas = detalle.articulos.map((articulo) => {
            const comprada = articulo.cantidad;
            const devuelta = 0; // El servidor informa devoluciones previas al calcular el máximo.
            return this.fb.group<LineaForm>({
              ventaLineaId: this.fb.nonNullable.control(articulo.ventaLineaId),
              productoId: this.fb.nonNullable.control(articulo.productoId),
              sku: this.fb.nonNullable.control(articulo.sku),
              descripcion: this.fb.nonNullable.control(
                `${articulo.nombre} · ${articulo.colorNombre} · ${articulo.talla}`,
              ),
              cantidadComprada: this.fb.nonNullable.control(comprada),
              cantidadDevuelta: this.fb.nonNullable.control(devuelta),
              cantidadSolicitada: this.fb.nonNullable.control(
                1,
                cantidadEntera(Math.max(0, comprada - devuelta)),
              ),
              precioUnitarioConIva: this.fb.nonNullable.control(articulo.precioUnitarioConIva),
              subtotalConIva: this.fb.nonNullable.control(
                articulo.precioUnitarioConIva * articulo.cantidad,
              ),
              varianteCambioId: this.fb.control<number | null>(null),
            });
          });
          this.form.controls.lineas.clear();
          lineas.forEach((linea) => this.form.controls.lineas.push(linea));
          if (this.form.controls.tipo.value === 'CAMBIO') this.cargarVariantes();
        },
        error: (error: unknown) => {
          this.error.set(mensajeError(error, 'No fue posible cargar las prendas del pedido.'));
        },
      });
  }

  protected cambiarTipo(): void {
    this.form.controls.lineas.controls.forEach((linea) =>
      linea.controls.varianteCambioId.setValue(null),
    );
    if (this.form.controls.tipo.value === 'CAMBIO') this.cargarVariantes();
  }

  protected onEvidencias(event: Event): void {
    const entrada = event.target as HTMLInputElement;
    const seleccionados = Array.from(entrada.files ?? []);
    this.error.set('');

    if (seleccionados.length > MAXIMO_EVIDENCIAS) {
      this.error.set('Se permiten hasta 3 imágenes de evidencia.');
      entrada.value = '';
      return;
    }
    if (seleccionados.some((archivo) => !TIPOS_IMAGEN.includes(archivo.type))) {
      this.error.set('Las evidencias deben ser JPG, PNG o WebP.');
      entrada.value = '';
      return;
    }
    if (seleccionados.some((archivo) => archivo.size > TAMANO_MAXIMO)) {
      this.error.set('Cada imagen debe pesar menos de 2 MB.');
      entrada.value = '';
      return;
    }

    this.liberarEvidencias();
    this.evidencias.set(
      seleccionados.map((archivo) => ({
        archivo,
        vistaPrevia: URL.createObjectURL(archivo),
      })),
    );
  }

  protected quitarEvidencia(indice: number): void {
    const actuales = this.evidencias();
    URL.revokeObjectURL(actuales[indice]?.vistaPrevia ?? '');
    this.evidencias.set(actuales.filter((_, posicion) => posicion !== indice));
  }

  protected enviarSolicitud(): void {
    if (this.enviando()) return;
    this.error.set('');
    this.form.markAllAsTouched();

    const pedidoId = this.form.controls.pedidoId.value;
    if (!pedidoId) {
      this.error.set('Selecciona un pedido entregado.');
      return;
    }
    if (this.form.controls.descripcion.invalid) {
      this.error.set('Describe el motivo con al menos 3 caracteres.');
      return;
    }

    const seleccionadas = this.form.controls.lineas.controls.filter(
      (linea) => linea.controls.cantidadSolicitada.value > 0,
    );
    if (seleccionadas.length === 0) {
      this.error.set('Indica al menos una prenda y cantidad.');
      return;
    }
    if (
      seleccionadas.some(
        (linea) =>
          linea.controls.cantidadSolicitada.value > this.maximo(linea) ||
          linea.controls.cantidadSolicitada.value < 1,
      )
    ) {
      this.error.set('La cantidad no puede exceder lo comprado menos lo ya devuelto.');
      return;
    }
    if (
      this.form.controls.tipo.value === 'CAMBIO' &&
      seleccionadas.some((linea) => !linea.controls.varianteCambioId.value)
    ) {
      this.error.set('Selecciona la variante de reemplazo en cada línea.');
      return;
    }

    const cuerpo = {
      pedido_id: pedidoId,
      tipo: this.form.controls.tipo.value,
      motivo: this.form.controls.motivo.value,
      descripcion: this.form.controls.descripcion.value.trim(),
      lineas: seleccionadas.map((linea) => ({
        venta_linea_id: linea.controls.ventaLineaId.value,
        cantidad: linea.controls.cantidadSolicitada.value,
        variante_cambio_id:
          this.form.controls.tipo.value === 'CAMBIO'
            ? linea.controls.varianteCambioId.value
            : null,
      })),
    };

    this.enviando.set(true);
    this.servicio
      .crear(cuerpo, this.evidencias().map((item) => item.archivo))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.enviando.set(false)),
      )
      .subscribe({
        next: (creada) => {
          this.avisos.mostrar(
            'exito',
            `Solicitud ${creada.folioCaso} registrada. La resolución depende de Flask.`,
          );
          this.enviada.emit(creada.folioCaso);
          this.form.reset({
            pedidoId: 0,
            tipo: 'DEVOLUCION',
            motivo: 'DEFECTO',
            descripcion: '',
          });
          this.form.controls.lineas.clear();
          this.liberarEvidencias();
          this.evidencias.set([]);
        },
        error: (error: unknown) => {
          this.error.set(mensajeError(error, 'No fue posible registrar la solicitud.'));
          this.avisos.mostrar('error', 'No se pudo registrar la solicitud.');
        },
      });
  }

  private cargarPedidos(): void {
    this.cargando.set(true);
    this.servicio
      .pedidosEntregados()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargando.set(false)),
      )
      .subscribe({
        next: (pedidos) => {
          this.pedidos.set(pedidos);
          const inicial =
            this.pedidoInicial() ||
            pedidos.find((pedido) => pedido.folio === this.folioInicial())?.id ||
            0;
          if (inicial) this.seleccionarPedido(inicial);
        },
        error: (error: unknown) => {
          this.error.set(mensajeError(error, 'No fue posible cargar tus pedidos entregados.'));
        },
      });
  }

  private cargarVariantes(): void {
    const productos = [
      ...new Set(
        this.form.controls.lineas.controls.map((linea) => linea.controls.productoId.value),
      ),
    ];
    if (productos.length === 0) return;
    this.cargandoVariantes.set(true);
    forkJoin(productos.map((productoId) => this.servicio.variantes(productoId)))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargandoVariantes.set(false)),
      )
      .subscribe({
        next: (grupos) => {
          const porProducto: Record<number, VarianteCatalogo[]> = {};
          productos.forEach((productoId, indice) => {
            porProducto[productoId] = (grupos[indice] ?? []).filter(
              (variante) =>
                variante.comprable !== false &&
                variante.activa !== false &&
                !variante.bajo_pedido &&
                variante.disponibilidad !== 'Agotado',
            );
          });
          this.opcionesVariante.set(porProducto);
        },
        error: (error: unknown) => {
          this.error.set(mensajeError(error, 'No fue posible cargar las variantes disponibles.'));
        },
      });
  }

  private liberarEvidencias(): void {
    this.evidencias().forEach((item) => URL.revokeObjectURL(item.vistaPrevia));
  }
}
