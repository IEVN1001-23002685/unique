import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CarritoServicio } from './servicios/carrito-servicio';

export interface ItemCarrito {
  idLinea: string;
  productoId: number;
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
export class Carrito {
  private readonly router = inject(Router);
  private readonly carrito = inject(CarritoServicio);

  /**
   * Fuente única del carrito de demostración. El setter conserva la posibilidad de
   * recibir items desde un padre; sin enlace externo se usa el estado en memoria.
   */
  @Input() set items(items: ItemCarrito[]) {
    this.carrito.reemplazar(items);
  }
  get items(): ItemCarrito[] {
    return this.carrito.items();
  }

  @Output() seguirComprando = new EventEmitter<void>();
  @Output() procederAlPago = new EventEmitter<{ items: ItemCarrito[]; totalEstimado: number }>();
  @Output() cerrar = new EventEmitter<void>();

  codigoCupon = '';
  descuentoPorcentaje = 0;
  mensajeCarrito = '';

  get tieneItemsAgotados(): boolean {
    return this.items.some((item) => item.estadoDisponibilidad === 'Agotado');
  }

  get subtotalConIva(): number {
    return this.items
      .filter((item) => item.estadoDisponibilidad !== 'Agotado')
      .reduce((acc, item) => acc + item.precioUnitarioConIva * item.cantidad, 0);
  }

  get costoEnvioEstimado(): number {
    if (this.subtotalConIva === 0) return 0;
    return this.subtotalConIva >= 900 ? 0 : 99;
  }

  get montoDescuento(): number {
    return Math.round(this.subtotalConIva * this.descuentoPorcentaje);
  }

  get totalEstimado(): number {
    return Math.max(0, this.subtotalConIva - this.montoDescuento + this.costoEnvioEstimado);
  }

  cambiarCantidad(item: ItemCarrito, delta: number): void {
    if (item.estadoDisponibilidad === 'Agotado') return;
    const siguiente = item.cantidad + delta;
    if (siguiente < 1) {
      this.eliminarItem(item.idLinea);
      return;
    }
    if (siguiente > 10) {
      this.carrito.cambiarCantidad(item.idLinea, 10);
      this.mensajeCarrito = 'Máximo 10 unidades permitidas por línea de producto.';
      return;
    }
    this.carrito.cambiarCantidad(item.idLinea, siguiente);
    this.mensajeCarrito = '';
  }

  eliminarItem(idLinea: string): void {
    this.carrito.eliminar(idLinea);
    this.mensajeCarrito = 'Producto eliminado del carrito.';
  }

  aplicarCupon(): void {
    const limpio = this.codigoCupon.trim().toUpperCase();
    if (!limpio) {
      this.mensajeCarrito = 'Escribe un código promocional para aplicarlo.';
      return;
    }
    if (limpio === 'UNIQUE10') {
      this.descuentoPorcentaje = 0.1;
      this.mensajeCarrito = 'Cupón UNIQUE10 aplicado: 10% de descuento simulado.';
    } else {
      this.descuentoPorcentaje = 0;
      this.mensajeCarrito = 'Código no válido en modo prueba (usa UNIQUE10 para probar 10%).';
    }
  }

  irAlCatalogo(): void {
    this.seguirComprando.emit();
    void this.router.navigate(['/catalogo']);
  }

  cerrarCarrito(): void {
    this.cerrar.emit();
    void this.router.navigate(['/catalogo']);
  }

  onProcederPago(): void {
    if (!this.items.length) {
      this.mensajeCarrito = 'Tu carrito está vacío.';
      return;
    }
    if (this.tieneItemsAgotados) {
      this.mensajeCarrito = 'Hay productos agotados en tu carrito. Elimínalos antes de continuar.';
      return;
    }
    this.procederAlPago.emit({
      items: this.items,
      totalEstimado: this.totalEstimado,
    });
    this.mensajeCarrito = `Listo para pasar al checkout con un total estimado de $${this.totalEstimado}.`;
    void this.router.navigate(['/pago']);
  }
}
