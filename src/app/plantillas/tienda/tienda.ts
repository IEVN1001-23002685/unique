import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BarraNavegacionTienda } from '../../compartido/componentes/barra-navegacion-tienda/barra-navegacion-tienda';

@Component({
  imports: [RouterOutlet, BarraNavegacionTienda],
  selector: 'app-tienda',
  styleUrl: './tienda.css',
  templateUrl: './tienda.html',
})
export class Tienda {}
