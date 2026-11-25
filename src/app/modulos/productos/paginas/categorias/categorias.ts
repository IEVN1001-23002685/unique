import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionProductos } from '../../componentes/navegacion-productos/navegacion-productos';
import type { CategoriaProducto } from '../../modelos/producto-maestro';
import { ProductosServicio } from '../../servicios/productos-servicio';

/** Alta y gestión de categorías: propiedad de M10 (§7 y §6.5). */
@Component({
  selector: 'app-categorias',
  imports: [ReactiveFormsModule, NavegacionProductos],
  templateUrl: './categorias.html',
  styleUrl: './categorias.css',
})
export class Categorias {
  protected readonly servicio = inject(ProductosServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly fb = inject(FormBuilder);

  protected readonly categorias = this.servicio.categorias;
  protected readonly editando = signal<number | undefined>(undefined);

  constructor() {
    this.servicio.recargar().subscribe();
  }

  protected readonly intento = signal(false);

  protected readonly forma = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(40)]],
    prefijo: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    usaTallas: [true],
    activa: [true],
    descripcion: ['', Validators.maxLength(140)],
  });

  protected invalido(campo: 'nombre' | 'prefijo'): boolean {
    const control = this.forma.controls[campo];
    return control.invalid && (control.touched || this.intento());
  }

  protected guardar(): void {
    this.intento.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa el nombre y el prefijo de la categoría.');
      return;
    }

    const raw = this.forma.getRawValue();
    this.servicio
      .guardarCategoria(
        {
          nombre: raw.nombre,
          prefijo: raw.prefijo,
          usaTallas: raw.usaTallas,
          activa: raw.activa,
          descripcion: raw.descripcion,
        },
        this.editando(),
      )
      .subscribe({
        next: (resultado) => {
          this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
          if (resultado.ok) {
            this.nueva();
          }
        },
        error: () => this.avisos.mostrar('error', 'No fue posible guardar la categoría en Flask.'),
      });
  }

  protected editar(categoria: CategoriaProducto): void {
    this.editando.set(categoria.id);
    this.forma.setValue({
      nombre: categoria.nombre,
      prefijo: categoria.prefijo,
      usaTallas: categoria.usaTallas,
      activa: categoria.activa,
      descripcion: categoria.descripcion,
    });
    this.intento.set(false);
  }

  protected nueva(): void {
    this.editando.set(undefined);
    this.forma.reset({ nombre: '', prefijo: '', usaTallas: true, activa: true, descripcion: '' });
    this.intento.set(false);
  }

  protected alternar(categoria: CategoriaProducto): void {
    this.servicio.alternarCategoria(categoria.id).subscribe({
      next: (resultado) =>
        this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje),
      error: () => this.avisos.mostrar('error', 'No fue posible cambiar la categoría en Flask.'),
    });
  }
}
