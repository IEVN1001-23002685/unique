import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { IProducto } from '../../../../nucleo/modelos/producto';
import { PRODUCTOS_SIMULADOS } from '../../datos-simulados/productos';
import { CarritoServicio } from '../../../carrito/servicios/carrito-servicio';

@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-detalle-producto',
  styleUrl: './detalle-producto.css',
  templateUrl: './detalle-producto.html',
})
export class DetalleProducto {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly carrito = inject(CarritoServicio);

  protected readonly producto = signal<IProducto | undefined>(undefined);
  protected readonly imagenNoDisponible = signal(false);

  constructor() {
    this.ruta.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const slug = parametros.get('slug') ?? '';
      this.imagenNoDisponible.set(false);
      this.producto.set(PRODUCTOS_SIMULADOS.find((producto) => producto.slug === slug));
    });
  }

  /** Agrega al carrito en memoria; la variante y el SKU son de demostración. */
  protected agregarAlCarrito(): void {
    const producto = this.producto();
    if (!producto) return;

    this.carrito.agregar({
      idLinea: `demo-${producto.id}`,
      productoId: producto.id,
      nombre: producto.nombre,
      // Formato PRODUCTO-TALLA-COLOR de demostración; la API real generará el SKU.
      sku: `${producto.slug.toUpperCase()}-CH-UNQ`,
      colorNombre: 'Único',
      talla: 'CH',
      precioUnitarioConIva: producto.precio,
      cantidad: 1,
      estadoDisponibilidad: 'Disponible',
      imagenUrl: producto.imagen,
    });

    void this.router.navigate(['/carrito']);
  }
}
