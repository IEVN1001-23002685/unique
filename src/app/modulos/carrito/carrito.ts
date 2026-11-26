import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { mensajeError } from '../../core/api/errores';
import { CarritoServicio } from './servicios/carrito-servicio';

export interface ItemCarrito {
  idLinea: string;
  varianteId: number;
  productoId?: number;
  nombre: string;
  sku: string;
  colorNombre: string;
  talla: string;
  precioUnitarioConIva: number;
  cantidad: number;
  estadoDisponibilidad: 'Disponible' | 'Pocas unidades' | 'Bajo pedido' | 'Agotado';
  fechaEstimada?: string;
  imagenUrl: string;
  cambioDetectado?: string;
}

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carrito.html',
  styles: [],
})
export class Carrito implements OnInit {
  private readonly router = inject(Router);
  private readonly carrito = inject(CarritoServicio);

  @Input() set items(_items: ItemCarrito[]) {
    // La fuente de verdad es Flask; el carrito ya no se reemplaza desde el padre.
  }
  get items(): ItemCarrito[] {
    return this.carrito.items();
  }

  mensajeCarrito = '';
  cargando = true;

  get tieneItemsAgotados(): boolean {
    return this.items.some(
      (item) => item.estadoDisponibilidad === 'Agotado' || !!item.cambioDetectado,
    );
  }

  get subtotalConIva(): number {
    return this.carrito.resumen().subtotal;
  }

  get totalArticulos(): number {
    return this.carrito.resumen().totalArticulos;
  }

  get puedePagar(): boolean {
    return this.carrito.resumen().puedePagar;
  }

  ngOnInit(): void {
    this.carrito
      .cargar()
      .subscribe({
        next: () => (this.cargando = false),
        error: (error: unknown) => {
          this.cargando = false;
          this.mensajeCarrito = mensajeError(error, 'No fue posible cargar tu carrito.');
        },
      });
  }

  cambiarCantidad(item: ItemCarrito, delta: number): void {
    const siguiente = item.cantidad + delta;
    const maxima = this.carrito.resumen().maxPiezasPorLinea;
    if (siguiente < 1) {
      this.eliminarItem(item.varianteId);
      return;
    }
    if (siguiente > maxima) {
      this.mensajeCarrito = `Máximo ${maxima} unidades permitidas por línea de producto.`;
      return;
    }

    this.carrito.cambiarCantidad(item.varianteId, siguiente).subscribe({
      next: () => (this.mensajeCarrito = ''),
      error: (error: unknown) => (this.mensajeCarrito = mensajeError(error)),
    });
  }

  eliminarItem(varianteId: number): void {
    this.carrito.eliminar(varianteId).subscribe({
      next: () => (this.mensajeCarrito = 'Producto eliminado del carrito.'),
      error: (error: unknown) => (this.mensajeCarrito = mensajeError(error)),
    });
  }

  irAlCatalogo(): void {
    void this.router.navigate(['/catalogo']);
  }

  cerrarCarrito(): void {
    void this.router.navigate(['/catalogo']);
  }

  onProcederPago(): void {
    if (!this.items.length) {
      this.mensajeCarrito = 'Tu carrito está vacío.';
      return;
    }
    if (!this.puedePagar || this.tieneItemsAgotados) {
      this.mensajeCarrito = 'Hay líneas que no se pueden pagar. Revisa tu carrito antes de continuar.';
      return;
    }
    void this.router.navigate(['/pago']);
  }
}
