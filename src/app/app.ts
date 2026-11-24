import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModalAutenticacion } from './compartido/componentes/modal-autenticacion/modal-autenticacion';

@Component({
  imports: [RouterOutlet, ModalAutenticacion],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
