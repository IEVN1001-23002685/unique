import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de las pantallas de consulta de M11; el editor se abre desde la biblioteca. */
@Component({
  selector: 'app-navegacion-recetas',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion-recetas.html',
  styleUrl: './navegacion-recetas.css',
})
export class NavegacionRecetas {}
