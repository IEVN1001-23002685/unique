import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas tipo píldora compartidas por las pantallas de M18. */
@Component({
  selector: 'app-navegacion-preparacion',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion-preparacion.html',
  styleUrl: './navegacion-preparacion.css',
})
export class NavegacionPreparacion {}
