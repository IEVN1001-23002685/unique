import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Página 403 del §10.2. No sustituye a los guards definitivos de Flask. */
@Component({
  selector: 'app-pagina-sin-acceso',
  imports: [RouterLink],
  templateUrl: './sin-acceso.html',
  styleUrl: './sin-acceso.css',
})
export class SinAcceso {}
