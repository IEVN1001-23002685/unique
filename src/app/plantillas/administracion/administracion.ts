import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AvisoToast } from '../../compartido/componentes/aviso-toast/aviso-toast';

/**
 * Bandera superior del panel administrativo.
 * El título se toma de los datos de la ruta; sin guards reales, los roles son
 * únicamente una etiqueta demostrativa hasta la integración con Flask.
 */
@Component({
  selector: 'app-administracion',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AvisoToast],
  templateUrl: './administracion.html',
  styleUrl: './administracion.css',
})
export class Administracion {
  private readonly ruta = inject(ActivatedRoute);

  protected readonly tituloModulo = String(this.ruta.snapshot.data['titulo'] ?? 'PANEL');
  protected readonly etiquetaRol = String(this.ruta.snapshot.data['rol'] ?? 'Administrador');
}
