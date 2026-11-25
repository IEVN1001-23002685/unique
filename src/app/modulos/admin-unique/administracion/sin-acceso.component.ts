import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-sin-acceso',
  standalone: true,
  imports: [RouterLink],
  template:
    '<main class="denied"><h1>403</h1><h2>Sin acceso</h2><p>Tu rol no tiene permisos para consultar esta sección.</p><a routerLink="/panel-admin">Volver al panel</a></main>',
  styles: [
    '.denied{min-height:100vh;display:grid;place-content:center;text-align:center;background:#F7F3F7;color:#542D59;font-family:Arial}.denied h1{font-size:72px;margin:0}.denied a{color:#8B548C}',
  ],
})
export class SinAccesoComponent {}
