import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas tipo píldora compartidas por las cuatro pantallas de M09. */
@Component({
  selector: 'app-navegacion-pedidos',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion-pedidos.html',
  styleUrl: './navegacion-pedidos.css',
})
export class NavegacionPedidos {}
