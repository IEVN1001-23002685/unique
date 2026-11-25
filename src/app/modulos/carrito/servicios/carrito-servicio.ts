import { inject, Injectable, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';
import type { ItemCarrito } from '../carrito';

export interface ResumenCarrito {
  items: ItemCarrito[];
  subtotal: number;
  totalArticulos: number;
  maxPiezasPorLinea: number;
  puedePagar: boolean;
}

interface LineaApi {
  id: number;
  variante_id: number;
  sku: string;
  nombre_producto: string;
  talla: string;
  color: string;
  precio_unitario: string;
  cantidad: number;
  disponibilidad: string;
  bajo_pedido: boolean;
  fecha_estimada: string | null;
  activa: boolean;
  comprable: boolean;
  imagen: string | null;
}

interface CarritoApi {
  items: LineaApi[];
  subtotal: string;
  total_articulos: number;
  max_piezas_por_linea: number;
  puede_pagar: boolean;
}

const RESUMEN_VACIO: ResumenCarrito = {
  items: [],
  subtotal: 0,
  totalArticulos: 0,
  maxPiezasPorLinea: 10,
  puedePagar: false,
};

/** Servicio de M04. Persiste el carrito en Flask y revalida disponibilidad en cada lectura. */
@Injectable({ providedIn: 'root' })
export class CarritoServicio {
  private readonly api = inject(ApiService);
  private readonly _items = signal<ItemCarrito[]>([]);
  private readonly _resumen = signal<ResumenCarrito>(RESUMEN_VACIO);

  readonly items = this._items.asReadonly();
  readonly resumen = this._resumen.asReadonly();

  cargar(): Observable<ResumenCarrito> {
    return this.api
      .get<CarritoApi>('/carrito')
      .pipe(map((carrito) => this.aResumen(carrito)), tap((resumen) => this.apply(resumen)));
  }

  agregar(item: ItemCarrito): Observable<ResumenCarrito> {
    if (!item.varianteId || item.varianteId <= 0) {
      return throwError(() => new Error('La variante seleccionada no es válida.'));
    }
    return this.api
      .put<CarritoApi>('/carrito/lineas', {
        variante_id: item.varianteId,
        cantidad: item.cantidad,
      })
      .pipe(map((carrito) => this.aResumen(carrito)), tap((resumen) => this.apply(resumen)));
  }

  cambiarCantidad(varianteId: number, cantidad: number): Observable<ResumenCarrito> {
    return this.api
      .put<CarritoApi>('/carrito/lineas', { variante_id: varianteId, cantidad })
      .pipe(map((carrito) => this.aResumen(carrito)), tap((resumen) => this.apply(resumen)));
  }

  eliminar(varianteId: number): Observable<ResumenCarrito> {
    return this.api
      .delete<void>(`/carrito/lineas/${varianteId}`)
      .pipe(switchMap(() => this.cargar()));
  }

  fusionar(lineas: Array<{ variante_id: number; cantidad: number }>): Observable<ResumenCarrito> {
    return this.api
      .post<CarritoApi>('/carrito/fusionar', { lineas })
      .pipe(map((carrito) => this.aResumen(carrito)), tap((resumen) => this.apply(resumen)));
  }

  limpiar(): void {
    this.apply(RESUMEN_VACIO);
  }

  private apply(resumen: ResumenCarrito): void {
    this._resumen.set(resumen);
    this._items.set(resumen.items);
  }

  private aResumen(carrito: CarritoApi): ResumenCarrito {
    return {
      items: carrito.items.map((linea) => this.aItem(linea)),
      subtotal: Number(carrito.subtotal),
      totalArticulos: carrito.total_articulos,
      maxPiezasPorLinea: carrito.max_piezas_por_linea,
      puedePagar: carrito.puede_pagar,
    };
  }

  private aItem(linea: LineaApi): ItemCarrito {
    const disponibilidad = this.aDisponibilidad(linea);
    return {
      idLinea: String(linea.variante_id),
      varianteId: linea.variante_id,
      nombre: linea.nombre_producto,
      sku: linea.sku,
      colorNombre: this.nombreColor(linea.color),
      talla: linea.talla,
      precioUnitarioConIva: Number(linea.precio_unitario),
      cantidad: linea.cantidad,
      estadoDisponibilidad: disponibilidad,
      fechaEstimada: linea.fecha_estimada ?? undefined,
      imagenUrl: linea.imagen ?? '',
      cambioDetectado: linea.comprable
        ? undefined
        : 'Esta variante cambió de disponibilidad. Revisa tu carrito antes de pagar.',
    };
  }

  private aDisponibilidad(linea: LineaApi): ItemCarrito['estadoDisponibilidad'] {
    if (!linea.activa || !linea.comprable) return 'Agotado';
    const estados: ItemCarrito['estadoDisponibilidad'][] = [
      'Disponible',
      'Pocas unidades',
      'Bajo pedido',
      'Agotado',
    ];
    return estados.includes(linea.disponibilidad as ItemCarrito['estadoDisponibilidad'])
      ? (linea.disponibilidad as ItemCarrito['estadoDisponibilidad'])
      : 'Agotado';
  }

  private nombreColor(codigo: string): string {
    const nombres: Record<string, string> = {
      BL: 'Blanco',
      NG: 'Negro',
      GR: 'Gris',
      NA: 'No aplica',
    };
    return nombres[codigo] ?? codigo;
  }
}
