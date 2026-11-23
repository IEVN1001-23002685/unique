import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type FormControl,
  type FormGroup,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionProduccion } from '../../componentes/navegacion-produccion/navegacion-produccion';
import type { MaterialOrden } from '../../modelos/produccion';
import { hoyISO, ProduccionServicio } from '../../servicios/produccion-servicio';
import { enteroPositivo } from '../../validadores/cantidad-entera';

type LineaForm = FormGroup<{
  varianteId: FormControl<number>;
  sku: FormControl<string>;
  cantidad: FormControl<number | null>;
}>;

@Component({
  selector: 'app-nueva-orden',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, NavegacionProduccion],
  templateUrl: './nueva-orden.html',
  styleUrls: ['./nueva-orden.css', '../../produccion-compartido.css'],
})
export class NuevaOrden {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosServicio);

  protected readonly servicio = inject(ProduccionServicio);
  protected readonly hoy = hoyISO();
  protected readonly opciones = computed(() => this.servicio.variantesDisponibles());

  readonly form = this.fb.group({
    fechaRequerida: this.fb.control<string>(''),
    notas: this.fb.control<string>(''),
    lineas: this.fb.array<LineaForm>([]),
  });

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly explosion = computed<MaterialOrden[]>(() => {
    const valores = this.valores();
    return (valores.lineas ?? []).flatMap((linea) => {
      const sku = linea.sku;
      const cantidad = linea.cantidad;
      return sku && Number.isInteger(cantidad) && (cantidad ?? 0) > 0
        ? this.servicio.explosionEstimada(sku, cantidad ?? 0)
        : [];
    });
  });

  protected readonly unidadesTotales = computed(() =>
    (this.valores().lineas ?? []).reduce((suma, linea) => suma + (linea.cantidad ?? 0), 0),
  );

  protected readonly enviando = signal(false);

  constructor() {
    this.agregarLinea();
  }

  protected get lineas(): FormArray<LineaForm> {
    return this.form.controls.lineas;
  }

  protected agregarLinea(): void {
    const primera = this.opciones()[0];
    const grupo = this.fb.group({
      varianteId: this.fb.control(primera?.varianteId ?? 0),
      sku: this.fb.control(primera?.sku ?? '', Validators.required),
      cantidad: this.fb.control<number | null>(1, [Validators.required, enteroPositivo]),
    }) as LineaForm;
    this.lineas.push(grupo);
    this.form.markAsDirty();
  }

  protected quitarLinea(indice: number): void {
    if (this.lineas.length <= 1) {
      return;
    }
    this.lineas.removeAt(indice);
    this.form.markAsDirty();
  }

  protected alCambiarVariante(grupo: LineaForm): void {
    const id = Number(grupo.controls.varianteId.value);
    const opcion = this.opciones().find((item) => item.varianteId === id);
    grupo.controls.sku.setValue(opcion?.sku ?? '');
    grupo.controls.sku.markAsTouched();
    this.form.markAsDirty();
  }

  protected guardar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa las líneas: cada variante necesita una cantidad entera mayor a cero.');
      return;
    }
    this.enviando.set(true);
    const valores = this.form.getRawValue();
    const resultado = this.servicio.crearOrden({
      lineas: valores.lineas.map((linea) => ({
        varianteId: Number(linea.varianteId),
        sku: String(linea.sku),
        nombreProducto:
          this.opciones().find((item) => item.varianteId === Number(linea.varianteId))?.nombreProducto ?? '',
        cantidad: Number(linea.cantidad),
      })),
      fechaRequerida: valores.fechaRequerida || null,
      notas: valores.notas,
    });

    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    this.enviando.set(false);
    if (!resultado.ok) {
      return;
    }

    const destino = resultado.folio
      ? this.servicio.ordenes().find((orden) => orden.folio === resultado.folio)?.id
      : this.servicio.ordenes().find((orden) => orden.folio === resultado.sumadaA)?.id;
    void this.router.navigate(destino === undefined ? ['/produccion'] : ['/produccion', destino]);
  }
}
