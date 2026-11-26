import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { decimalPositivo } from '../../../../compartido/validadores/validadores-negocio';
import { mensajeError } from '../../../../core/api/errores';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoCompra } from '../../componentes/chip-estado-compra/chip-estado-compra';
import { NavegacionCompras } from '../../componentes/navegacion-compras/navegacion-compras';
import type { DatosRecepcion, LineaOrdenCompra, ResultadoRecepcion } from '../../modelos/compra';
import { ComprasServicio, redondear4 } from '../../servicios/compras-servicio';

type LineaRecepcionForma = FormGroup<{
  ordenCompraLineaId: FormControl<number>;
  pesoKg: FormControl<number | null>;
  anchoCm: FormControl<number | null>;
  largoM: FormControl<number | null>;
  cantidadBaseMedida: FormControl<number>;
  cantidadBaseAceptada: FormControl<number>;
  cantidadBaseRechazada: FormControl<number>;
  motivoRechazo: FormControl<string>;
}>;

/** Regla de presentación: aceptada + rechazada = medida; rechazo requiere motivo. */
const validarLineaRecepcion: ValidatorFn = (control): ValidationErrors | null => {
  const valor = control.getRawValue() as {
    cantidadBaseMedida: number;
    cantidadBaseAceptada: number;
    cantidadBaseRechazada: number;
    motivoRechazo: string;
  };
  const medida = Number(valor.cantidadBaseMedida ?? 0);
  const aceptada = Number(valor.cantidadBaseAceptada ?? 0);
  const rechazada = Number(valor.cantidadBaseRechazada ?? 0);

  if (!(medida > 0)) {
    return { medida: true };
  }
  if (aceptada < 0 || rechazada < 0) {
    return { negativo: true };
  }
  if (Math.abs(aceptada + rechazada - medida) > 0.0001) {
    return { cuadre: true };
  }
  if (rechazada > 0 && valor.motivoRechazo.trim() === '') {
    return { motivo: true };
  }
  return null;
};

@Component({
  selector: 'app-recepciones',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    ChipEstadoCompra,
    NavegacionCompras,
    ModalConfirmacion,
  ],
  templateUrl: './recepciones.html',
  styleUrls: ['./recepciones.css', '../../compras-compartido.css'],
})
export class Recepciones {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly auth = inject(AuthStateService);
  private readonly avisos = inject(AvisosServicio);
  protected readonly servicio = inject(ComprasServicio);
  /** Misma resolución de rol que el resto de M14: sesión real o perfil de demostración. */
  protected readonly esAdministrador = this.servicio.puedeGestionarCompras;

  protected readonly ordenesDisponibles = computed(() =>
    this.servicio.ordenes().filter((orden) => ['EMITIDA', 'PARCIAL'].includes(orden.estado)),
  );

  protected readonly ordenId = signal<number>(this.inicial());
  protected readonly orden = computed(() =>
    this.ordenesDisponibles().find((item) => item.id === this.ordenId()),
  );
  protected readonly intentoEnvio = signal(false);
  protected readonly resultado = signal<ResultadoRecepcion | null>(null);
  protected readonly confirmarCierre = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorGuardado = signal('');

  /** FormArray explícito para conservar el tipado estricto de cada línea. */
  protected readonly lineasForm = new FormArray<LineaRecepcionForma>([]);

  protected readonly formulario = this.fb.group({
    documentoProveedor: [''],
    recibidaPor: [this.auth.usuario()?.nombre ?? '', [Validators.required]],
    notas: [''],
    cerrarConFaltante: [false],
    lineas: this.lineasForm,
  });

  private ordenInicializada = false;

  constructor() {
    effect(() => {
      if (this.ordenInicializada || !this.servicio.cargado()) {
        return;
      }
      const inicial = this.inicial();
      if (inicial > 0) {
        this.ordenInicializada = true;
        this.ordenId.set(inicial);
        this.prepararLineas(this.orden()?.lineas ?? []);
      }
    });
  }

  protected alCambiar(evento: Event): void {
    this.ordenId.set(Number((evento.target as HTMLSelectElement).value));
    this.resultado.set(null);
    this.errorGuardado.set('');
    this.servicio.reiniciarIdempotencia();
    const orden = this.orden();
    this.prepararLineas(orden?.lineas ?? []);
  }

  protected reintentar(): void {
    this.ordenInicializada = false;
    this.resultado.set(null);
    this.errorGuardado.set('');
    this.servicio.reiniciarIdempotencia();
    this.servicio.recargar().subscribe();
  }

  protected material(linea: LineaOrdenCompra) {
    return this.servicio.obtenerMaterial(linea.materialId);
  }

  protected pendiente(linea: LineaOrdenCompra): number {
    return redondear4(Math.max(0, linea.cantidadBasePedida - linea.cantidadBaseAceptada));
  }

  protected medidaCalculada(indice: number): number | null {
    const control = this.formulario.controls.lineas.at(indice).controls;
    const ancho = control.anchoCm.value;
    const largo = control.largoM.value;
    if (ancho === null || largo === null || ancho <= 0 || largo <= 0) {
      return null;
    }
    return redondear4((ancho / 100) * largo);
  }

  protected hayFaltante(): boolean {
    return this.formulario.controls.lineas.controls.some(
      (linea) => linea.controls.cantidadBaseRechazada.value > 0,
    );
  }

  protected errorLinea(indice: number, clave: string): boolean {
    const linea = this.formulario.controls.lineas.at(indice);
    return linea.invalid && linea.hasError(clave) && (linea.touched || this.intentoEnvio());
  }

  protected campoInvalido(
    indice: number,
    campo: 'cantidadBaseMedida' | 'cantidadBaseAceptada',
  ): boolean {
    const control = this.formulario.controls.lineas.at(indice).controls[campo];
    return control.invalid && (control.touched || this.intentoEnvio());
  }

  protected guardar(): void {
    this.intentoEnvio.set(true);
    this.errorGuardado.set('');
    if (this.guardando()) {
      return;
    }
    if (this.formulario.invalid || !this.orden()) {
      this.formulario.markAllAsTouched();
      this.avisos.mostrar(
        'error',
        'Revisa las medidas: aceptada más rechazada debe igualar la medida.',
      );
      return;
    }

    if (
      this.hayFaltante() &&
      this.formulario.controls.cerrarConFaltante.value &&
      !this.esAdministrador()
    ) {
      this.formulario.controls.cerrarConFaltante.setValue(false);
      this.avisos.mostrar(
        'error',
        'Solo el Administrador puede cerrar la orden con faltante; quedará PARCIAL.',
      );
      return;
    }

    if (this.hayFaltante() && this.formulario.controls.cerrarConFaltante.value) {
      this.confirmarCierre.set(true);
      return;
    }
    this.registrar();
  }

  protected confirmarCerrarConFaltante(): void {
    this.confirmarCierre.set(false);
    this.registrar();
  }

  private registrar(): void {
    const orden = this.orden();
    if (!orden || this.guardando()) {
      return;
    }

    const valor = this.formulario.getRawValue();
    const datos: DatosRecepcion = {
      ordenCompraId: orden.id,
      documentoProveedor: valor.documentoProveedor ?? '',
      notas: valor.notas ?? '',
      recibidaPor: valor.recibidaPor ?? '',
      cerrarConFaltante: valor.cerrarConFaltante ?? false,
      lineas: valor.lineas.map((linea) => ({
        ordenCompraLineaId: linea.ordenCompraLineaId,
        pesoKg: linea.pesoKg,
        anchoCm: linea.anchoCm,
        largoM: linea.largoM,
        cantidadBaseMedida: redondear4(linea.cantidadBaseMedida),
        cantidadBaseAceptada: redondear4(linea.cantidadBaseAceptada),
        cantidadBaseRechazada: redondear4(linea.cantidadBaseRechazada),
        motivoRechazo: linea.motivoRechazo.trim() === '' ? null : linea.motivoRechazo.trim(),
      })),
    };

    this.guardando.set(true);
    this.servicio
      .registrarRecepcion(datos)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (resultado) => {
          if (!resultado) {
            this.errorGuardado.set('La orden ya no admite recepciones en este estado.');
            this.avisos.mostrar('error', this.errorGuardado());
            return;
          }
          this.resultado.set(resultado);
          const referencia =
            resultado.recepcion.folio || `recepción ${resultado.recepcion.id}`;
          this.avisos.mostrar(
            'exito',
            `${referencia} se registró en Flask; la orden quedó ${resultado.estadoOrden}.`,
          );
        },
        error: (error: unknown) => {
          const mensaje = mensajeError(error, 'Flask no pudo registrar la recepción.');
          this.errorGuardado.set(mensaje);
          this.avisos.mostrar('error', mensaje);
        },
      });
  }

  private prepararLineas(lineas: LineaOrdenCompra[]): void {
    this.formulario.controls.lineas.clear();
    for (const linea of lineas) {
      this.formulario.controls.lineas.push(this.nuevaLinea(linea));
    }
    this.intentoEnvio.set(false);
  }

  private nuevaLinea(linea: LineaOrdenCompra): LineaRecepcionForma {
    const pendiente = redondear4(
      Math.max(0, linea.cantidadBasePedida - linea.cantidadBaseAceptada),
    );
    return this.fb.group(
      {
        ordenCompraLineaId: this.fb.nonNullable.control(linea.id),
        pesoKg: this.fb.control<number | null>(null),
        anchoCm: this.fb.control<number | null>(null),
        largoM: this.fb.control<number | null>(null),
        cantidadBaseMedida: this.fb.nonNullable.control(pendiente, [
          Validators.required,
          decimalPositivo,
        ]),
        cantidadBaseAceptada: this.fb.nonNullable.control(pendiente, [
          Validators.required,
          Validators.min(0),
        ]),
        cantidadBaseRechazada: this.fb.nonNullable.control(0, [Validators.min(0)]),
        motivoRechazo: this.fb.nonNullable.control(''),
      },
      { validators: validarLineaRecepcion },
    );
  }

  private inicial(): number {
    const folio = this.ruta.snapshot.queryParamMap.get('oc');
    const porFolio = folio
      ? this.servicio.ordenes().find((orden) => orden.folio === folio)
      : undefined;
    if (porFolio && ['EMITIDA', 'PARCIAL'].includes(porFolio.estado)) {
      return porFolio.id;
    }
    return this.ordenesDisponibles()[0]?.id ?? 0;
  }
}
