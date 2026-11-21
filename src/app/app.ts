import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Registro } from './modulos/registro';
import { InicioSesion, CredencialesLogin } from './modulos/inicio-sesion';

@Component({
  imports: [RouterOutlet, CommonModule, Registro, InicioSesion, CredencialesLogin],
  selector: 'app-root',
  standalone:true;
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('unique');
  vistaActual: 'login' | 'registro' = 'login';

manejarLogin(datos: CredencialesLogin): void {
    console.log('Listo para conectar al backend (login):', datos);
  }
}
export class App {}
