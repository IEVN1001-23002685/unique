import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas tipo píldora compartidas por las pantallas de M08. */
@Component({
  selector: 'app-navegacion-ventas',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion-ventas.html',
  styleUrl: './navegacion-ventas.css',
})
export class NavegacionVentas {}
