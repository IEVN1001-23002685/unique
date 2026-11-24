import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface OpcionPestana {
  ruta: string;
  etiqueta: string;
}

/** Cascarón de M22: cinco pantallas de administración, sin selector de rol. */
@Component({
  selector: 'app-administracion-sistema',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './administracion-sistema.html',
  styleUrls: ['./estilos-compartidos.css', './administracion-sistema.css'],
})
export class AdministracionSistema {
  protected readonly pestanas: OpcionPestana[] = [
    { ruta: '/sistema/usuarios', etiqueta: 'Usuarios y roles' },
    { ruta: '/sistema/clientes', etiqueta: 'Clientes' },
    { ruta: '/sistema/catalogos', etiqueta: 'Catálogos' },
    { ruta: '/sistema/configuracion', etiqueta: 'Configuración' },
    { ruta: '/sistema/bitacora', etiqueta: 'Bitácora' },
  ];
}
