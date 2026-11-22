import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Portada mínima del panel: solo ofrece acceso al módulo implementado. */
@Component({
  selector: 'app-inicio-panel',
  imports: [RouterLink],
  templateUrl: './inicio-panel.html',
  styleUrl: './inicio-panel.css',
})
export class InicioPanel {}
