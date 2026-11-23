import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type ValidatorFn } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import {
  decimalNoNegativo,
  decimalPositivo,
  mermaPct,
} from '../../../../compartido/validadores/validadores-negocio';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionInventario } from '../../componentes/navegacion-inventario/navegacion-inventario';
import {
  CATEGORIAS,
  type CategoriaMaterial,
  type Material,
  type UnidadBase,
} from '../../modelos/inventario';
import { InventarioServicio } from '../../servicios/inventario-servicio';

@Component({
  selector: 'app-catalogo-materiales',
  imports: [CurrencyPipe, DecimalPipe, ReactiveFormsModule, RouterLink, NavegacionInventario, ModalConfirmacion],
  templateUrl: './catalogo-materiales.html',
  styleUrls: ['./catalogo-materiales.css', '../../inventario-compartido.css'],
})
export class CatalogoMateriales {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosServicio);
  protected readonly servicio = inject(InventarioServicio);

  protected readonly categorias = CATEGORIAS;
  protected readonly unidades: UnidadBase[] = ['m²', 'm', 'pieza'];
  protected readonly intentoEnvio = signal(false);
  protected readonly noEncontrado = signal(false);
  protected readonly materialEliminar = signal<Material | null>(null);

  private readonly modo = String(this.ruta.snapshot.data['modo'] ?? 'listado');
  protected readonly esFormulario = this.modo === 'nuevo' || this.modo === 'editar';
  protected readonly esEdicion = this.modo === 'editar';
  protected readonly idEditar = Number(this.ruta.snapshot.paramMap.get('id') ?? 0);

  protected readonly materiales = computed(() => this.servicio.materiales());

  private readonly codigoUnico: ValidatorFn = (control) => {
    const valor = String(control.value ?? '');
    if (valor.trim() === '') {
      return null;
    }
    return this.servicio.existeCodigo(valor, this.idEditar) ? { codigoDuplicado: true } : null;
  };

  protected readonly formulario = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.maxLength(12), this.codigoUnico]],
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    categoria: ['Tela' as CategoriaMaterial, [Validators.required]],
    unidadBase: ['m²' as UnidadBase, [Validators.required]],
    unidadCompra: ['', [Validators.required]],
    factorCompraBase: [0, [Validators.required, decimalPositivo]],
    presentacion: ['', [Validators.required]],
    // EMP-ETE tiene costo provisional 0 en el catálogo semilla (§11.2).
    costoEstandarBase: [0, [Validators.required, decimalNoNegativo]],
    mermaEstandarPct: [0, [Validators.required, mermaPct]],
    plazoDias: [7, [Validators.required, Validators.min(1), Validators.max(365)]],
    porColor: [false],
  });

  constructor() {
    if (!this.esEdicion) {
      return;
    }
    const material = this.servicio.obtenerMaterial(this.idEditar);
    if (!material) {
      this.noEncontrado.set(true);
      return;
    }
    this.formulario.patchValue({
      codigo: material.codigo,
      nombre: material.nombre,
      categoria: material.categoria,
      unidadBase: material.unidadBase,
      unidadCompra: material.unidadCompra,
      factorCompraBase: material.factorCompraBase,
      presentacion: material.presentacion,
      costoEstandarBase: material.costoEstandarBase,
      mermaEstandarPct: material.mermaEstandarPct,
      plazoDias: material.plazoDias,
      porColor: material.porColor,
    });
    // El código identifica al material en recetas y movimientos: no se cambia.
    this.formulario.controls.codigo.disable();
  }

  protected esInvalido(
    campo:
      | 'codigo'
      | 'nombre'
      | 'unidadCompra'
      | 'factorCompraBase'
      | 'presentacion'
      | 'costoEstandarBase'
      | 'mermaEstandarPct'
      | 'plazoDias',
  ): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.intentoEnvio());
  }

  protected guardar(): void {
    this.intentoEnvio.set(true);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa los campos marcados antes de guardar.');
      return;
    }

    const valor = this.formulario.getRawValue();
    const anterior = this.esEdicion ? this.servicio.obtenerMaterial(this.idEditar) : undefined;
    const material: Material = {
      id: this.idEditar,
      codigo: valor.codigo,
      nombre: valor.nombre.trim(),
      categoria: valor.categoria,
      unidadBase: valor.unidadBase,
      unidadCompra: valor.unidadCompra.trim(),
      factorCompraBase: valor.factorCompraBase,
      presentacion: valor.presentacion.trim(),
      costoEstandarBase: valor.costoEstandarBase,
      mermaEstandarPct: valor.mermaEstandarPct,
      plazoDias: Math.trunc(valor.plazoDias),
      porColor: valor.porColor,
      activo: anterior?.activo ?? true,
    };

    this.servicio.guardarMaterial(material);
    this.avisos.mostrar(
      'exito',
      this.esEdicion
        ? `${material.codigo} se actualizó en la demostración.`
        : `${material.codigo} se dio de alta; sus existencias se crearon en memoria.`,
    );
    void this.router.navigate(['/inventario-mp/catalogo']);
  }

  protected confirmarEliminar(material: Material): void {
    this.materialEliminar.set(material);
  }

  protected eliminar(): void {
    const material = this.materialEliminar();
    this.materialEliminar.set(null);
    if (!material) {
      return;
    }
    const resultado = this.servicio.eliminarMaterial(material.id);
    if (resultado === 'desactivado') {
      this.avisos.mostrar(
        'advertencia',
        `${material.codigo} tiene lotes: se desactivó en lugar de eliminarse. Flask debe validar recetas antes de una baja definitiva.`,
      );
      return;
    }
    this.avisos.mostrar('exito', `${material.codigo} se eliminó del catálogo de demostración.`);
  }
}
