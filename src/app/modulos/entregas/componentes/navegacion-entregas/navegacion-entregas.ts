import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Pestañas tipo píldora compartidas por las cinco pantallas de M19. */
@Component({
  selector: 'app-navegacion-entregas',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navegacion-entregas.html',
  styleUrl: './navegacion-entregas.css',
})
export class NavegacionEntregas {}
