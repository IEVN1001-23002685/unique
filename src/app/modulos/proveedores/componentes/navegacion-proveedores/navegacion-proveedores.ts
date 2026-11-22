import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas tipo píldora de M13; reutilizada por las cuatro pantallas. */
@Component({
  selector: 'app-navegacion-proveedores',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion-proveedores.html',
  styleUrl: './navegacion-proveedores.css',
})
export class NavegacionProveedores {}
