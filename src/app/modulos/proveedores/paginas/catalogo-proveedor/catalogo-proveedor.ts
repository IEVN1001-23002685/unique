import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, forkJoin, map } from 'rxjs';
import { detalleError, mensajeError } from '../../../../core/api/errores';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { InventarioServicio } from '../../../inventario/servicios/inventario-servicio';
import { ChipEstatus } from '../../componentes/chip-estatus/chip-estatus';
import { NavegacionProveedores } from '../../componentes/navegacion-proveedores/navegacion-proveedores';
import { ProveedoresServicio } from '../../servicios/proveedores-servicio';
import { esMaterialCritico } from '../../modelos/proveedor';
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
    // La unidad la deriva M15; no se exige captura manual (ver vincularUnidad).
    unidadCompra: [valores?.unidadCompra ?? ''],
    minimoCompra: [valores?.minimoCompra ?? 0, [Validators.required, Validators.min(0)]],
    plazoDias: [valores?.plazoDias ?? 0, [Validators.required, Validators.min(0), Validators.max(365)]],
    esPrincipal: [valores?.esPrincipal ?? false],
    vigenciaHasta: [valores?.vigenciaHasta ?? ''],
    activo: [valores?.activo ?? true],
  });
}

type LineaGrupo = ReturnType<typeof crearGrupoLinea>;

@Component({
  selector: 'app-catalogo-proveedor',
  imports: [ReactiveFormsModule, RouterLink, ChipEstatus, NavegacionProveedores, ModalConfirmacion],
  templateUrl: './catalogo-proveedor.html',
  styleUrl: './catalogo-proveedor.css',
})
export class CatalogoProveedor {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly servicio = inject(ProveedoresServicio);
  private readonly inventario = inject(InventarioServicio);
  private readonly avisos = inject(AvisosServicio);

  /**
   * El id debe ser reactivo: Angular reutiliza este componente cuando se navega
   * de `/proveedores/1/materiales` a `/proveedores/2/materiales`.
   */
  protected readonly id = toSignal(
    this.ruta.paramMap.pipe(
      map((parametros) => {
        const valor = parametros.get('id');
        return valor !== null && /^\d+$/.test(valor) ? Number(valor) : 0;
      }),
    ),
    { initialValue: 0 },
  );

  protected readonly proveedor = computed(() => this.servicio.obtenerPorId(this.id()));
  protected readonly materialesReferencia = computed<MaterialReferencia[]>(() =>
    this.inventario
      .materiales()
      .filter((material) => material.activo)
      .map((material) => ({
        id: material.id,
        nombre: material.nombre,
        categoria: material.categoria,
        critico: esMaterialCritico(material.codigo),
        unidadCompra: material.unidadCompra,
      })),
  );
  protected readonly lineaAEliminar = signal<number | null>(null);
  protected readonly intentoEnvio = signal(false);
  protected readonly guardando = signal(false);
  protected readonly cargando = this.servicio.cargando;
  protected readonly errorCarga = this.servicio.errorCarga;
  protected readonly errorDetalle = this.servicio.errorDetalle;
  protected readonly catalogoDisponible = computed(() => this.materialesReferencia().length > 0);

  protected readonly formulario = this.fb.nonNullable.group({
    lineas: this.fb.array<LineaGrupo>([]),
  });

  protected get lineas(): FormArray<LineaGrupo> {
    return this.formulario.controls.lineas;
  }

  private idInicializado = 0;

  constructor() {
    effect(() => {
      const id = this.id();
      const proveedor = this.proveedor();
      if (id === 0 || !proveedor || this.idInicializado === id) {
        return;
      }
      this.idInicializado = id;
      this.lineas.clear();
      for (const material of proveedor.materiales) {
        const grupo = crearGrupoLinea(this.fb, {
          materialId: material.materialId,
          precioCompra: material.precioCompra,
          unidadCompra: material.unidadCompra,
          minimoCompra: material.minimoCompra,
          plazoDias: material.plazoDias,
          esPrincipal: material.esPrincipal,
          vigenciaHasta: material.vigenciaHasta ?? '',
          activo: material.activo,
        });
        this.lineas.push(grupo);
        this.vincularUnidad(grupo);
      }
    });
  }

  /**
   * La unidad se sincroniza con valueChanges, no con el evento `change` del DOM:
   * así no dependemos del orden en que Angular dispare sus listeners y el campo
   * nunca queda vacío por una carrera de eventos.
   */
  private vincularUnidad(grupo: LineaGrupo): void {
    grupo.controls.materialId.valueChanges.subscribe((materialId) => {
      grupo.controls.unidadCompra.setValue(this.referencia(materialId)?.unidadCompra ?? '');
    });
  }

  /**
   * Cobertura de todo el catálogo activo de M15. Flask exige principal para
   * cualquier material y alterno solo para los cuatro críticos; la loneta no
   * está en esa lista. Es un aviso informativo, no impide guardar.
   */
  protected readonly materialesConAlerta = computed(() =>
    this.materialesReferencia()
      .map((referencia) => ({
        referencia,
        alerta: this.alertaCobertura(referencia.id),
      }))
      .filter(
        (entrada): entrada is { referencia: MaterialReferencia; alerta: string } =>
          entrada.alerta !== null,
      ),
  );

  protected referencia(id: number): MaterialReferencia | undefined {
    return this.materialesReferencia().find((material) => material.id === id);
  }

  protected categoria(id: number): CategoriaMaterial | undefined {
    return this.referencia(id)?.categoria;
  }

  protected alertaCobertura(materialId: number): string | null {
    const lineas = this.servicio.cobertura().get(materialId) ?? [];
    const activas = lineas.filter((linea) => linea.activo);

    if (activas.length === 0) {
      return this.referencia(materialId)?.critico
        ? 'Crítico: sin proveedor principal ni alterno'
        : 'Sin proveedor principal';
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

  /** Diagnóstico visible: dice qué control falla, no solo «revisa la línea». */
  protected errorDeLinea(indice: number): string {
    const linea = this.lineas.at(indice);
    if (!linea) {
      return '';
    }
    const errores: string[] = [];
    if (linea.controls.materialId.invalid) {
      errores.push('selecciona un material');
    }
    if (linea.controls.precioCompra.invalid) {
      errores.push('precio mayor a 0.01');
    }
    if (linea.controls.plazoDias.invalid) {
      errores.push('plazo entre 0 y 365 días');
    }
    return errores.join(', ');
  }

  protected materialIdDe(indice: number): number {
    return this.lineas.at(indice)?.value.materialId ?? 0;
  }

  protected vigenciaDe(indice: number): string {
    return this.lineas.at(indice)?.value.vigenciaHasta ?? '';
  }

  protected agregarLinea(): void {
    const grupo = crearGrupoLinea(this.fb);
    this.lineas.push(grupo);
    this.vincularUnidad(grupo);
  }

  /**
   * Flask deriva `unidad_compra` del catálogo M15 y el esquema ignora el campo
   * si Angular lo envía. Sincronizar el valor evita que la interfaz muestre una
   * unidad que no se va a persistir.
   */
  protected sincronizarUnidad(indice: number): void {
    const linea = this.lineas.at(indice);
    if (!linea) {
      return;
    }
    const materialId = Number(linea.controls.materialId.value);
    linea.controls.unidadCompra.setValue(this.referencia(materialId)?.unidadCompra ?? '');
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
      'Línea removida; Flask persiste el cambio al guardar el proveedor.',
    );
  }

  protected guardar(): void {
    this.intentoEnvio.set(true);

    if (this.formulario.invalid) {
      this.avisos.mostrar(
        'error',
        'Revisa las líneas marcadas: selecciona un material, captura un precio mayor a cero y la unidad de compra.',
      );
      return;
    }

    const proveedor = this.proveedor();
    if (!proveedor) {
      this.avisos.mostrar(
        'error',
        'No fue posible identificar el proveedor. Regresa al padrón y vuelve a entrar al catálogo.',
      );
      return;
    }

    const valores = this.lineas.getRawValue();
    if (new Set(valores.map((valor) => valor.materialId)).size !== valores.length) {
      this.avisos.mostrar('error', 'Un material no puede repetirse en el catálogo del proveedor.');
      return;
    }

    const anteriores = new Map(proveedor.materiales.map((linea) => [linea.materialId, linea]));
    const materiales: MaterialProveedor[] = valores.map((valor) => {
      const referencia = this.referencia(valor.materialId);
      const anterior = anteriores.get(valor.materialId);

      return {
        // El id definitivo lo asigna Flask; 0 solo marca una línea todavía no persistida.
        id: anterior?.id ?? 0,
        materialId: valor.materialId,
        material: referencia?.nombre ?? `Material ${valor.materialId}`,
        categoria: referencia?.categoria ?? 'Avío',
        critico: referencia?.critico ?? false,
        precioCompra: Number(valor.precioCompra),
        // Se deriva de M15 en el momento del guardado, aunque el evento del DOM
        // no haya alcanzado a sincronizar el control (Flask la ignora de todos modos).
        unidadCompra: (this.referencia(valor.materialId)?.unidadCompra ?? valor.unidadCompra).trim(),
        minimoCompra: Number(valor.minimoCompra),
        plazoDias: Number(valor.plazoDias),
        esPrincipal: valor.esPrincipal,
        vigenciaHasta: valor.vigenciaHasta === '' ? null : valor.vigenciaHasta,
        activo: valor.activo,
      };
    });

    this.guardando.set(true);
    this.servicio
      .reemplazarMateriales(this.id(), materiales)
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: () => this.avisos.mostrar('exito', 'Catálogo del proveedor actualizado en Flask.'),
        error: (error: unknown) => {
          const prefijo = mensajeError(error, 'No fue posible guardar el catálogo.');
          const campos = detalleError(error)
            .map((item) => {
              if (item && typeof item === 'object') {
                const fila = item as Record<string, unknown>;
                return `${String(fila['campo'] ?? '')}: ${String(fila['mensaje'] ?? '')}`.trim();
              }
              return String(item);
            })
            .filter((texto) => texto.length > 0)
            .join(' · ');
          this.avisos.mostrar('error', campos ? `${prefijo} — ${campos}` : prefijo);
        },
      });
  }

  /** El botón de cobertura depende de M15 y M13: recarga ambos servicios. */
  protected reintentar(): void {
    forkJoin([this.inventario.recargar(), this.servicio.recargar()]).subscribe();
  }
}
