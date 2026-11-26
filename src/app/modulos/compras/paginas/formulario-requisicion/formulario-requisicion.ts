import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { decimalPositivo } from '../../../../compartido/validadores/validadores-negocio';
import { mensajeError } from '../../../../core/api/errores';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionCompras } from '../../componentes/navegacion-compras/navegacion-compras';
import type {
  LineaRequisicion,
  MaterialCompra,
  OrigenRequisicion,
  Prioridad,
  Requisicion,
} from '../../modelos/compra';
import { ComprasServicio, redondear4 } from '../../servicios/compras-servicio';

@Component({
  selector: 'app-formulario-requisicion',
  imports: [ReactiveFormsModule, RouterLink, NavegacionCompras],
  templateUrl: './formulario-requisicion.html',
  styleUrls: ['./formulario-requisicion.css', '../../compras-compartido.css'],
})
export class FormularioRequisicion {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosServicio);
  private readonly auth = inject(AuthStateService);
  protected readonly servicio = inject(ComprasServicio);

  protected readonly materiales = this.servicio.materiales;
  protected readonly intentoEnvio = signal(false);
  protected readonly noEncontrado = signal(false);

  private readonly parametroId = this.ruta.snapshot.paramMap.get('id');
  protected readonly idEditar =
    this.parametroId !== null && /^\d+$/.test(this.parametroId) ? Number(this.parametroId) : 0;
  protected readonly esEdicion = this.idEditar > 0;

  protected readonly origenes: { valor: OrigenRequisicion; etiqueta: string }[] = [
    { valor: 'ALERTA', etiqueta: 'Alerta de inventario' },
    { valor: 'ORDEN_PRODUCCION', etiqueta: 'Orden de producción' },
    { valor: 'MANUAL', etiqueta: 'Manual' },
  ];
  protected readonly prioridades: Prioridad[] = ['NORMAL', 'URGENTE'];

  protected readonly formulario = this.fb.nonNullable.group({
    origen: ['MANUAL' as OrigenRequisicion, [Validators.required]],
    ordenProduccion: [''],
    prioridad: ['NORMAL' as Prioridad, [Validators.required]],
    solicitadaPor: [this.auth.usuario()?.nombre ?? '', [Validators.required]],
    notas: [''],
    lineas: this.fb.nonNullable.array([this.nuevaLinea()]),
  });

  private formularioInicializado = false;

  constructor() {
    if (!this.esEdicion) {
      return;
    }

    effect(() => {
      if (this.formularioInicializado || !this.servicio.cargado()) {
        return;
      }
      const requisicion = this.servicio.obtenerRequisicion(this.idEditar);
      if (!requisicion) {
        this.noEncontrado.set(true);
        return;
      }
      this.formularioInicializado = true;
      this.formulario.patchValue({
        origen: requisicion.origen,
        ordenProduccion: requisicion.ordenProduccion ?? '',
        prioridad: requisicion.prioridad,
        solicitadaPor: requisicion.solicitadaPor,
        notas: requisicion.notas ?? '',
      });
      this.formulario.controls.lineas.clear();
      for (const linea of requisicion.lineas) {
        this.formulario.controls.lineas.push(this.nuevaLinea(linea));
      }

      // En edición se conservan origen, material y faltante; solo se ajustan cantidades.
      this.formulario.controls.origen.disable();
      for (const control of this.formulario.controls.lineas.controls) {
        control.controls.materialId.disable();
        control.controls.cantidadBaseFaltante.disable();
      }
    });
  }

  protected materialDe(indice: number): MaterialCompra | undefined {
    const id = this.formulario.controls.lineas.at(indice).controls.materialId.value;
    return this.servicio.obtenerMaterial(id);
  }

  protected baseSugerida(indice: number): number {
    const linea = this.formulario.controls.lineas.at(indice).controls;
    return this.servicio.basePresentaciones(
      linea.materialId.value,
      linea.cantidadCompraSugerida.value,
    );
  }

  protected calcularSugerida(indice: number): void {
    const linea = this.formulario.controls.lineas.at(indice).controls;
    linea.cantidadCompraSugerida.setValue(
      this.servicio.cantidadPresentaciones(
        linea.materialId.value,
        linea.cantidadBaseFaltante.value,
      ),
    );
  }

  protected agregarLinea(): void {
    this.formulario.controls.lineas.push(this.nuevaLinea());
  }

  protected quitarLinea(indice: number): void {
    if (this.formulario.controls.lineas.length > 1) {
      this.formulario.controls.lineas.removeAt(indice);
    }
  }

  protected esInvalido(campo: 'ordenProduccion' | 'solicitadaPor'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.intentoEnvio());
  }

  protected lineaInvalida(
    indice: number,
    campo: 'cantidadBaseFaltante' | 'cantidadCompraSugerida' | 'color',
  ): boolean {
    const control = this.formulario.controls.lineas.at(indice).controls[campo];
    return control.invalid && (control.touched || this.intentoEnvio());
  }

  protected guardar(): void {
    this.intentoEnvio.set(true);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa los campos marcados antes de continuar.');
      return;
    }

    const valor = this.formulario.getRawValue();
    if (valor.origen === 'ORDEN_PRODUCCION' && valor.ordenProduccion.trim() === '') {
      this.formulario.controls.ordenProduccion.setErrors({ requerido: true });
      this.formulario.controls.ordenProduccion.markAsTouched();
      this.avisos.mostrar('error', 'Indica la orden de producción de origen.');
      return;
    }

    const previo = this.esEdicion ? this.servicio.obtenerRequisicion(this.idEditar) : undefined;
    const sinColor = valor.lineas.findIndex(
      (linea) =>
        (this.servicio.obtenerMaterial(linea.materialId)?.color ?? null) !== null &&
        linea.color.trim() === '',
    );
    if (sinColor >= 0) {
      this.formulario.controls.lineas.at(sinColor).controls.color.setErrors({ requerido: true });
      this.formulario.controls.lineas.at(sinColor).controls.color.markAsTouched();
      this.avisos.mostrar('error', 'Indica el color de la línea del material.');
      return;
    }

    const requisicion: Requisicion = {
      id: this.esEdicion ? this.idEditar : 0,
      folio: previo?.folio ?? '',
      origen: valor.origen,
      ordenProduccion: valor.origen === 'ORDEN_PRODUCCION' ? valor.ordenProduccion.trim() : null,
      fecha: previo?.fecha ?? '',
      estado: previo?.estado ?? 'PENDIENTE',
      prioridad: valor.prioridad,
      solicitadaPor: valor.solicitadaPor.trim(),
      notas: valor.notas.trim() === '' ? null : valor.notas.trim(),
      lineas: valor.lineas.map((linea, indice) => ({
        id: previo?.lineas[indice]?.id ?? 0,
        materialId: linea.materialId,
        color: linea.color.trim() === '' ? null : linea.color.trim(),
        cantidadBaseFaltante: redondear4(linea.cantidadBaseFaltante),
        cantidadCompraSugerida: Math.max(1, Math.floor(linea.cantidadCompraSugerida)),
        cantidadCompraAtendida: previo?.lineas[indice]?.cantidadCompraAtendida ?? 0,
      })),
    };

    this.servicio.guardarRequisicion(requisicion).subscribe({
      next: (guardada) => {
        this.avisos.mostrar('exito', `${guardada.folio} se guardó en Flask.`);
        void this.router.navigate(['/compras']);
      },
      error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
    });
  }

  private nuevaLinea(linea?: LineaRequisicion) {
    return this.fb.nonNullable.group({
      materialId: [linea?.materialId ?? 1, [Validators.required]],
      color: [linea?.color ?? 'Gris'],
      cantidadBaseFaltante: [
        linea?.cantidadBaseFaltante ?? 0,
        [Validators.required, decimalPositivo],
      ],
      cantidadCompraSugerida: [
        linea?.cantidadCompraSugerida ?? 1,
        [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)],
      ],
    });
  }
}
