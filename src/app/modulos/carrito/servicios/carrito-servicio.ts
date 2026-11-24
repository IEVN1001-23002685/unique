import { Injectable, signal } from '@angular/core';
import type { ItemCarrito } from '../carrito';

/**
 * Carrito de demostración en memoria.
 *
 * No persiste en localStorage, no llama a Flask y no confirma compras: solo permite
 * recorrer el flujo de interfaz (detalle -> carrito -> pago) con datos coherentes.
 * El servicio real de Flask sustituirá este estado cuando exista el contrato M04/M05.
 */
@Injectable({ providedIn: 'root' })
export class CarritoServicio {
  private readonly _items = signal<ItemCarrito[]>([
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
      imagenUrl: '/Logo1.png',
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
      cambioDetectado: 'Esta variante se agotó; retírala para continuar.',
    },
  ]);

  readonly items = this._items.asReadonly();

  /** Reemplaza el contenido desde un componente padre (útil al integrar la API real). */
  reemplazar(items: ItemCarrito[]): void {
    this._items.set([...items]);
  }

  agregar(item: ItemCarrito): void {
    this._items.update((items) => {
      const existente = items.find((i) => i.sku === item.sku && i.talla === item.talla);
      if (existente) {
        return items.map((i) =>
          i === existente ? { ...i, cantidad: Math.min(10, i.cantidad + item.cantidad) } : i,
        );
      }
      return [...items, item];
    });
  }

  cambiarCantidad(idLinea: string, cantidad: number): void {
    this._items.update((items) =>
      items.map((i) => (i.idLinea === idLinea ? { ...i, cantidad } : i)),
    );
  }

  eliminar(idLinea: string): void {
    this._items.update((items) => items.filter((i) => i.idLinea !== idLinea));
  }
}
