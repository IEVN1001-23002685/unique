import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas de las cuatro pantallas documentadas de M12. */
@Component({
  selector: 'app-navegacion-inventario-pt',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion-inventario-pt.html',
  styleUrl: './navegacion-inventario-pt.css',
})
export class NavegacionInventarioPt {}
