import { Component, inject } from '@angular/core';
import { PerfilDemoServicio } from '../../../nucleo/servicios/perfil-demo-servicio';

/** Selector visual de perfil; no sustituye a los guards ni a la autenticación de Flask. */
@Component({
  selector: 'app-selector-perfil-demo',
  imports: [],
  templateUrl: './selector-perfil-demo.html',
  styleUrl: './selector-perfil-demo.css',
})
export class SelectorPerfilDemo {
  protected readonly perfilDemo = inject(PerfilDemoServicio);
}
