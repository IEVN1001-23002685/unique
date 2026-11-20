import { Injectable, signal } from '@angular/core';

/**
 * Estado visual compartido entre la barra de navegación de la tienda
 * y las páginas del catálogo. No hay llamadas a backend: es un filtro en memoria.
 */
@Injectable({
  providedIn: 'root',
})
export class BusquedaCatalogoServicio {
  readonly termino = signal('');
}
