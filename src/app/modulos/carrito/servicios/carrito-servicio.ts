import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../../core/api/api.service';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { esCantidadEnteraValida } from '../../../compartido/validadores/validadores-negocio';
import { AvisosServicio } from '../../../nucleo/servicios/avisos-servicio';
import {
  CARRITO_VACIO,
  ItemCarrito,
  MAX_PIEZAS_POR_LINEA,
  ResumenCarrito,
} from '../modelos/carrito';

export type { ResumenCarrito } from '../modelos/carrito';

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

/** Clave exclusiva del carrito de invitado; nunca contiene datos de una cuenta. */
const CLAVE_INVITADO = 'unique.carrito.invitado.v1';

/**
 * Servicio de M04. Con sesión, Flask es la fuente de verdad; sin sesión, el carrito
 * vive solo en el navegador y se fusiona al iniciar sesión (§7 M04 y §8.3).
 * No reserva existencias: eso ocurre en M05.
 */
@Injectable({ providedIn: 'root' })
export class CarritoServicio {
  private readonly api = inject(ApiService);
  private readonly sesion = inject(AuthStateService);
  private readonly avisos = inject(AvisosServicio);
  private readonly _items = signal<ItemCarrito[]>([]);
  private readonly _resumen = signal<ResumenCarrito>(CARRITO_VACIO);

  readonly items = this._items.asReadonly();
  readonly resumen = this._resumen.asReadonly();

  constructor() {
    if (!this.sesion.autenticado()) {
      const local = this.leerLocal();
      if (local.length) {
        this.apply(this.resumenLocal(local));
      }
    }
  }

  cargar(): Observable<ResumenCarrito> {
    if (!this.sesion.autenticado()) {
      const resumen = this.resumenLocal(this.leerLocal());
      this.apply(resumen);
      return of(resumen);
    }

    return this.api.get<CarritoApi>('/carrito').pipe(
      map((carrito) => this.aResumen(carrito)),
      tap((resumen) => this.apply(resumen)),
      catchError((error: unknown) => {
        // Si la sesión expiró, el visitante conserva su carrito local sin fingir lectura del servidor.
        if (error instanceof HttpErrorResponse && error.status === 401) {
          const local = this.resumenLocal(this.leerLocal());
          this.apply(local);
          return of(local);
        }
        return throwError(() => error);
      }),
    );
  }

  agregar(item: ItemCarrito): Observable<ResumenCarrito> {
    if (!Number.isInteger(item.varianteId) || item.varianteId <= 0) {
      return throwError(() => new Error('La variante seleccionada no es válida.'));
    }
    if (!esCantidadEnteraValida(item.cantidad, MAX_PIEZAS_POR_LINEA)) {
      return throwError(
        () => new Error(`La cantidad debe ser un entero de 1 a ${MAX_PIEZAS_POR_LINEA}.`),
      );
    }

    if (!this.sesion.autenticado()) {
      // UQ(carrito, variante): una sola línea por variante, como en el servidor.
      const lineas = this.leerLocal().filter((linea) => linea.varianteId !== item.varianteId);
      const resumen = this.resumenLocal([
        ...lineas,
        { ...item, idLinea: String(item.varianteId) },
      ]);
      this.guardarLocal(resumen.items);
      this.apply(resumen);
      return of(resumen);
    }

    return this.api
      .put<CarritoApi>('/carrito/lineas', {
        variante_id: item.varianteId,
        cantidad: item.cantidad,
      })
      .pipe(map((carrito) => this.aResumen(carrito)), tap((resumen) => this.apply(resumen)));
  }

  cambiarCantidad(varianteId: number, cantidad: number): Observable<ResumenCarrito> {
    if (!esCantidadEnteraValida(cantidad, MAX_PIEZAS_POR_LINEA)) {
      return throwError(
        () => new Error(`La cantidad debe ser un entero de 1 a ${MAX_PIEZAS_POR_LINEA}.`),
      );
    }

    if (!this.sesion.autenticado()) {
      const lineas = this.leerLocal().map((linea) =>
        linea.varianteId === varianteId ? { ...linea, cantidad } : linea,
      );
      if (!lineas.some((linea) => linea.varianteId === varianteId)) {
        return throwError(() => new Error('La línea ya no está en tu carrito.'));
      }
      const resumen = this.resumenLocal(lineas);
      this.guardarLocal(resumen.items);
      this.apply(resumen);
      return of(resumen);
    }

    return this.api
      .put<CarritoApi>('/carrito/lineas', { variante_id: varianteId, cantidad })
      .pipe(map((carrito) => this.aResumen(carrito)), tap((resumen) => this.apply(resumen)));
  }

  eliminar(varianteId: number): Observable<ResumenCarrito> {
    if (!this.sesion.autenticado()) {
      const resumen = this.resumenLocal(
        this.leerLocal().filter((linea) => linea.varianteId !== varianteId),
      );
      this.guardarLocal(resumen.items);
      this.apply(resumen);
      return of(resumen);
    }

    return this.api
      .delete<void>(`/carrito/lineas/${varianteId}`)
      .pipe(switchMap(() => this.cargar()));
  }

  /** Traslada las líneas del invitado al carrito de la cuenta recién autenticada. */
  fusionar(lineas: Array<{ variante_id: number; cantidad: number }>): Observable<ResumenCarrito> {
    return this.api
      .post<CarritoApi>('/carrito/fusionar', { lineas })
      .pipe(
        map((carrito) => this.aResumen(carrito)),
        tap((resumen) => {
          this.apply(resumen);
          this.guardarLocal([]);
        }),
      );
  }

  /** Llamar justo después de iniciar sesión o registrarse; conserva el carrito si falla Flask. */
  sincronizarAlIniciarSesion(): Observable<ResumenCarrito> {
    const lineas = this.leerLocal();
    if (!lineas.length) {
      return this.cargar();
    }
    return this.fusionar(
      lineas.map((linea) => ({ variante_id: linea.varianteId, cantidad: linea.cantidad })),
    ).pipe(
      tap({
        error: () =>
          this.avisos.mostrar(
            'advertencia',
            'No se pudo fusionar el carrito de invitado; se conservó en este navegador.',
          ),
      }),
    );
  }

  /** Uso exclusivo de M05 tras una venta confirmada por Flask. */
  limpiar(): void {
    this.guardarLocal([]);
    this.apply({ ...CARRITO_VACIO, origen: this.sesion.autenticado() ? 'servidor' : 'navegador' });
  }

  private apply(resumen: ResumenCarrito): void {
    this._resumen.set(resumen);
    this._items.set(resumen.items);
  }

  private resumenLocal(items: ItemCarrito[]): ResumenCarrito {
    const subtotal = items.reduce(
      (total, item) => total + item.precioUnitarioConIva * item.cantidad,
      0,
    );
    const totalArticulos = items.reduce((total, item) => total + item.cantidad, 0);
    const puedePagar =
      items.length > 0 &&
      items.every(
        (item) =>
          item.estadoDisponibilidad !== 'Agotado' &&
          !item.cambioDetectado &&
          esCantidadEnteraValida(item.cantidad, MAX_PIEZAS_POR_LINEA),
      );

    return {
      items,
      subtotal: Math.round(subtotal * 100) / 100,
      totalArticulos,
      maxPiezasPorLinea: MAX_PIEZAS_POR_LINEA,
      puedePagar,
      origen: 'navegador',
    };
  }

  private leerLocal(): ItemCarrito[] {
    try {
      if (typeof sessionStorage === 'undefined') return [];
      const crudo = sessionStorage.getItem(CLAVE_INVITADO);
      if (!crudo) return [];
      const datos: unknown = JSON.parse(crudo);
      if (!Array.isArray(datos)) return [];
      return datos.filter((valor): valor is ItemCarrito => {
        if (typeof valor !== 'object' || valor === null) return false;
        const linea = valor as Partial<ItemCarrito>;
        return (
          typeof linea.varianteId === 'number' &&
          typeof linea.cantidad === 'number' &&
          typeof linea.nombre === 'string' &&
          lineasValidas(linea.estadoDisponibilidad)
        );
      });
    } catch {
      return [];
    }
  }

  private guardarLocal(items: ItemCarrito[]): void {
    try {
      if (typeof sessionStorage === 'undefined') return;
      if (items.length) {
        sessionStorage.setItem(CLAVE_INVITADO, JSON.stringify(items));
      } else {
        sessionStorage.removeItem(CLAVE_INVITADO);
      }
    } catch {
      // Almacenamiento bloqueado: el carrito sigue vivo en memoria durante la sesión.
    }
  }

  private aResumen(carrito: CarritoApi): ResumenCarrito {
    const items = (carrito.items ?? []).map((linea) => this.aItem(linea));
    return {
      items,
      subtotal: Number(carrito.subtotal) || 0,
      totalArticulos: carrito.total_articulos ?? items.reduce((total, item) => total + item.cantidad, 0),
      maxPiezasPorLinea: carrito.max_piezas_por_linea || MAX_PIEZAS_POR_LINEA,
      puedePagar: !!carrito.puede_pagar && items.length > 0,
      origen: 'servidor',
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
      precioUnitarioConIva: Number(linea.precio_unitario) || 0,
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

function lineasValidas(estado: unknown): boolean {
  return (
    estado === undefined ||
    estado === 'Disponible' ||
    estado === 'Pocas unidades' ||
    estado === 'Bajo pedido' ||
    estado === 'Agotado'
  );
}
