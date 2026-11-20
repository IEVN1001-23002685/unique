import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { IProducto } from '../../../../nucleo/modelos/producto';
import { PRODUCTOS_SIMULADOS } from '../../datos-simulados/productos';

@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-detalle-producto',
  styleUrl: './detalle-producto.css',
  templateUrl: './detalle-producto.html',
})
export class DetalleProducto {
  private readonly ruta = inject(ActivatedRoute);

  protected readonly producto = signal<IProducto | undefined>(undefined);
  protected readonly imagenNoDisponible = signal(false);

  constructor() {
    this.ruta.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const slug = parametros.get('slug') ?? '';
      this.imagenNoDisponible.set(false);
      this.producto.set(PRODUCTOS_SIMULADOS.find((producto) => producto.slug === slug));
    });
  }
}
