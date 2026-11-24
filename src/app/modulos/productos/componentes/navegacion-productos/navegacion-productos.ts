import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de las pantallas de M10. El parámetro activo cubre la ruta de edición. */
@Component({
  selector: 'app-navegacion-productos',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion-productos.html',
  styleUrl: './navegacion-productos.css',
})
export class NavegacionProductos {
  readonly activo = input<'catalogo' | 'nuevo' | 'variantes' | null>(null);
}
