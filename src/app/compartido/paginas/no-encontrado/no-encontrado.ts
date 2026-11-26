import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Página 404 del §10.2. */
@Component({
  selector: 'app-no-encontrado',
  imports: [RouterLink],
  templateUrl: './no-encontrado.html',
  styleUrl: './no-encontrado.css',
})
export class NoEncontrado {}
