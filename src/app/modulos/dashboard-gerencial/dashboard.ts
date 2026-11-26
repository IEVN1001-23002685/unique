import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type {
  CanalDashboard,
  PeriodoDashboard,
  RolDashboard,
  SeccionDashboard,
} from './modelos/dashboard';
import { DashboardServicio } from './servicios/dashboard-servicio';

interface OpcionPestana {
  seccion: SeccionDashboard;
  ruta: string;
  etiqueta: string;
  soloAdmin?: boolean;
}

/** Cascarón común de M20: filtros, alertas abiertas, pestañas y exportación. */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard.html',
  styleUrls: ['./estilos-compartidos.css', './dashboard.css'],
})
export class Dashboard {
  protected readonly servicio = inject(DashboardServicio);
  private readonly router = inject(Router);

  protected readonly pestanas: OpcionPestana[] = [
    { seccion: 'resumen', ruta: '/dashboard/resumen', etiqueta: 'Resumen' },
    {
      seccion: 'ventas-productos',
      ruta: '/dashboard/ventas-productos',
      etiqueta: 'Ventas y productos',
      soloAdmin: true,
    },
    {
      seccion: 'produccion-merma',
      ruta: '/dashboard/produccion-merma',
      etiqueta: 'Producción y merma',
    },
    {
      seccion: 'abastecimiento',
      ruta: '/dashboard/abastecimiento',
      etiqueta: 'Abastecimiento',
    },
    {
      seccion: 'logistica-devoluciones',
      ruta: '/dashboard/logistica-devoluciones',
      etiqueta: 'Logística y devoluciones',
    },
  ];

  protected alCambiarPeriodo(evento: Event): void {
    this.servicio.actualizarFiltro(
      'periodo',
      (evento.target as HTMLSelectElement).value as PeriodoDashboard,
    );
  }

  protected alCambiarCategoria(evento: Event): void {
    this.servicio.actualizarFiltro(
      'categoriaId',
      Number((evento.target as HTMLSelectElement).value),
    );
  }

  protected alCambiarProducto(evento: Event): void {
    this.servicio.actualizarFiltro(
      'productoId',
      Number((evento.target as HTMLSelectElement).value),
    );
  }

  protected alCambiarColor(evento: Event): void {
    this.servicio.actualizarFiltro('color', (evento.target as HTMLSelectElement).value);
  }

  protected alCambiarTalla(evento: Event): void {
    this.servicio.actualizarFiltro('talla', (evento.target as HTMLSelectElement).value);
  }

  protected alCambiarCanal(evento: Event): void {
    this.servicio.actualizarFiltro(
      'canal',
      (evento.target as HTMLSelectElement).value as CanalDashboard,
    );
  }

  protected alCambiarRol(evento: Event): void {
    const rol = (evento.target as HTMLSelectElement).value as RolDashboard;
    this.servicio.cambiarRol(rol);
    if (rol === 'Operativo' && this.seccionActual() === 'ventas-productos') {
      void this.router.navigate(['/dashboard', 'resumen']);
    }
  }

  protected exportar(): void {
    this.servicio.exportarCsv(this.seccionActual());
  }

  private seccionActual(): SeccionDashboard {
    const url = this.router.url.split('?')[0] ?? '';
    if (url.includes('ventas-productos')) {
      return 'ventas-productos';
    }
    if (url.includes('produccion-merma')) {
      return 'produccion-merma';
    }
    if (url.includes('abastecimiento')) {
      return 'abastecimiento';
    }
    if (url.includes('logistica-devoluciones')) {
      return 'logistica-devoluciones';
    }
    return 'resumen';
  }
}
