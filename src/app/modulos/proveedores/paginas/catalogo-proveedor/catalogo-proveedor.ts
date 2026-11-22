import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { ChipEstatus } from '../../componentes/chip-estatus/chip-estatus';
import { NavegacionProveedores } from '../../componentes/navegacion-proveedores/navegacion-proveedores';
import { ProveedoresServicio } from '../../servicios/proveedores-servicio';
import { MATERIALES_REFERENCIA } from '../../datos-simulados/proveedores';
import type {
  CategoriaMaterial,
  MaterialProveedor,
  MaterialReferencia,
} from '../../modelos/proveedor';

interface LineaFormValue {
  materialId: number;
  precioCompra: number;
  unidadCompra: string;
  minimoCompra: number;
  plazoDias: number;
  esPrincipal: boolean;
  vigenciaHasta: string;
  activo: boolean;
}

function crearGrupoLinea(fb: FormBuilder, valores?: Partial<LineaFormValue>) {
  return fb.nonNullable.group({
    materialId: [valores?.materialId ?? 0, [Validators.required, Validators.min(1)]],
    precioCompra: [valores?.precioCompra ?? 0, [Validators.required, Validators.min(0.01)]],
    unidadCompra: [valores?.unidadCompra ?? '', Validators.required],
    minimoCompra: [valores?.minimoCompra ?? 0, [Validators.required, Validators.min(0)]],
    plazoDias: [valores?.plazoDias ?? 0, [Validators.required, Validators.min(0)]],
    esPrincipal: [valores?.esPrincipal ?? false],
    vigenciaHasta: [valores?.vigenciaHasta ?? ''],
    activo: [valores?.activo ?? true],
  });
}

type LineaGrupo = ReturnType<typeof crearGrupoLinea>;

@Component({
  selector: 'app-catalogo-proveedor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ChipEstatus,
    NavegacionProveedores,
    ModalConfirmacion,
  ],
  templateUrl: './catalogo-proveedor.html',
  styleUrl: './catalogo-proveedor.css',
})
export class CatalogoProveedor {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly servicio = inject(ProveedoresServicio);
  private readonly avisos = inject(AvisosServicio);

  private readonly parametroId = this.ruta.snapshot.paramMap.get('id');
  protected readonly id =
    this.parametroId !== null && /^\d+$/.test(this.parametroId) ? Number(this.parametroId) : 0;

  protected readonly proveedor = computed(() => this.servicio.obtenerPorId(this.id));
  protected readonly materialesReferencia = MATERIALES_REFERENCIA;
  protected readonly lineaAEliminar = signal<number | null>(null);
  protected readonly intentoEnvio = signal(false);

  protected readonly formulario = this.fb.nonNullable.group({
    lineas: this.fb.array<LineaGrupo>([]),
  });

  protected get lineas(): FormArray<LineaGrupo> {
    return this.formulario.controls.lineas;
  }

  constructor() {
    const proveedor = this.proveedor();
    if (!proveedor) {
      return;
    }

    for (const material of proveedor.materiales) {
      this.lineas.push(
        crearGrupoLinea(this.fb, {
          materialId: material.materialId,
          precioCompra: material.precioCompra,
          unidadCompra: material.unidadCompra,
          minimoCompra: material.minimoCompra,
          plazoDias: material.plazoDias,
          esPrincipal: material.esPrincipal,
          vigenciaHasta: material.vigenciaHasta ?? '',
          activo: material.activo,
        }),
      );
    }
  }

  /** Alertas de cobertura calculadas con el padrón guardado (demostración). */
  protected readonly materialesConAlerta = computed(() => {
    const proveedor = this.proveedor();
    if (!proveedor) {
      return [] as { referencia: MaterialReferencia; alerta: string }[];
    }

    const ids = [...new Set(proveedor.materiales.map((material) => material.materialId))];
    return ids
      .map((id) => ({
        referencia: this.referencia(id),
        alerta: this.alertaCobertura(id),
      }))
      .filter(
        (entrada): entrada is { referencia: MaterialReferencia; alerta: string } =>
          entrada.referencia !== undefined && entrada.alerta !== null,
      );
  });

  protected referencia(id: number): MaterialReferencia | undefined {
    return this.materialesReferencia.find((material) => material.id === id);
  }

  protected categoria(id: number): CategoriaMaterial | undefined {
    return this.referencia(id)?.categoria;
  }

  protected alertaCobertura(materialId: number): string | null {
    const lineas = this.servicio.cobertura().get(materialId) ?? [];
    const activas = lineas.filter((linea) => linea.activo);

    if (activas.length === 0) {
      return 'Sin proveedores activos';
    }
    if (!activas.some((linea) => linea.esPrincipal)) {
      return 'Sin proveedor principal';
    }
    if (this.referencia(materialId)?.critico && activas.length < 2) {
      return 'Crítico: requiere proveedor alterno';
    }
    return null;
  }

  protected estadoVigencia(vigencia: string): 'vigente' | 'vencida' | 'sin-vigencia' {
    if (vigencia === '') {
      return 'sin-vigencia';
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(`${vigencia}T00:00:00`);
    return fecha >= hoy ? 'vigente' : 'vencida';
  }

  protected etiquetaVigencia(vigencia: string): string {
    const estado = this.estadoVigencia(vigencia);
    if (estado === 'vencida') {
      return 'Vencida';
    }
    return estado === 'sin-vigencia' ? 'Sin vigencia' : 'Vigente';
  }

  protected lineaInvalida(indice: number): boolean {
    const linea = this.lineas.at(indice);
    return linea !== undefined && linea.invalid;
  }

  protected materialIdDe(indice: number): number {
    return this.lineas.at(indice)?.value.materialId ?? 0;
  }

  protected vigenciaDe(indice: number): string {
    return this.lineas.at(indice)?.value.vigenciaHasta ?? '';
  }

  protected agregarLinea(): void {
    this.lineas.push(crearGrupoLinea(this.fb));
  }

  protected confirmarEliminacionLinea(): void {
    const indice = this.lineaAEliminar();
    if (indice === null) {
      return;
    }

    this.lineas.removeAt(indice);
    this.lineaAEliminar.set(null);
    this.avisos.mostrar(
      'informacion',
      'Línea removida solo en memoria; la eliminación real queda pendiente de Flask.',
    );
  }

  protected guardar(): void {
    this.intentoEnvio.set(true);

    if (this.formulario.invalid) {
      return;
    }

    const proveedor = this.proveedor();
    if (!proveedor) {
      return;
    }

    let siguienteId = proveedor.materiales.reduce((maximo, linea) => Math.max(maximo, linea.id), 0) + 1;

    const materiales: MaterialProveedor[] = this.lineas.getRawValue().map((valor, indice) => {
      const referencia = this.referencia(valor.materialId);
      const anterior = proveedor.materiales[indice];

      return {
        id: anterior?.id ?? siguienteId++,
        materialId: valor.materialId,
        material: referencia?.nombre ?? `Material ${valor.materialId}`,
        categoria: referencia?.categoria ?? 'Avío',
        critico: referencia?.critico ?? false,
        precioCompra: Number(valor.precioCompra),
        unidadCompra: valor.unidadCompra.trim(),
        minimoCompra: Number(valor.minimoCompra),
        plazoDias: Number(valor.plazoDias),
        esPrincipal: valor.esPrincipal,
        vigenciaHasta: valor.vigenciaHasta === '' ? null : valor.vigenciaHasta,
        activo: valor.activo,
      };
    });

    this.servicio.reemplazarMateriales(this.id, materiales);
    this.avisos.mostrar(
      'exito',
      'Catálogo actualizado solo en memoria (demostración). Persistencia pendiente de Flask.',
    );
  }
}
