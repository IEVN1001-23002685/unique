import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  styles: []
})
export class Carrito {
  @Input() items: ItemCarrito[] = [
    {
      idLinea: '101',
      productoId: 1,
      nombre: 'Sudadera Lila Oversize',
      sku: 'UNQ-SUD-LIL-CH',
      colorNombre: 'Lila',
      talla: 'CH',
      precioUnitarioConIva: 549,
      cantidad: 1,
      estadoDisponibilidad: 'Disponible',
      imagenUrl: '/Logo1.png'
    },
    {
      idLinea: '202',
      productoId: 2,
      nombre: 'Playera Básica UNIQUE',
      sku: 'UNQ-PLY-BLA-G',
      colorNombre: 'Blanco',
      talla: 'G',
      precioUnitarioConIva: 299,
      cantidad: 1,
      estadoDisponibilidad: 'Agotado',
      imagenUrl: '/Logo1.png',
      cambioDetectado: 'Esta variante se agotó; retírala para continuar.'
    }
  ];

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
      item.cantidad = 10;
      this.mensajeCarrito = 'Máximo 10 unidades permitidas por línea de producto.';
      return;
    }
    item.cantidad = siguiente;
    this.mensajeCarrito = '';
  }

  eliminarItem(idLinea: string): void {
    this.items = this.items.filter((i) => i.idLinea !== idLinea);
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
      totalEstimado: this.totalEstimado
    });
    this.mensajeCarrito = `Listo para pasar al checkout con un total estimado de $${this.totalEstimado}.`;
  }
}