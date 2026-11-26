import { Injectable, signal } from '@angular/core';

/** Estado compartido entre la barra de navegación y el catálogo; M03 lo envía como filtro `q`. */
@Injectable({
  providedIn: 'root',
})
export class BusquedaCatalogoServicio {
  readonly termino = signal('');
}
