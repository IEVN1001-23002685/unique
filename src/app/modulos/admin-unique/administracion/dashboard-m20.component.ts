import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../../core/api/errores';
import { DashboardService } from '../services/dashboard.service';
import { descargarTexto } from '../services/descargas';
import { AuthSessionService } from '../services/auth-session.service';
import {
  DashboardAbastecimiento,
  DashboardLogistica,
  DashboardProduccion,
  DashboardResumen,
  DashboardVentas,
} from '../services/ui-admin.models';

type Pestana = 'resumen' | 'ventas' | 'produccion' | 'abasto' | 'logistica';

@Component({
  selector: 'app-dashboard-m20',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard-m20.component.html',
  styleUrl: '../preparacion/modulos-admin.css',
})
export class DashboardM20Component implements OnInit {
  private readonly servicio = inject(DashboardService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthSessionService);

  resumen: DashboardResumen | null = null;
  ventas: DashboardVentas | null = null;
  produccion: DashboardProduccion | null = null;
  abastecimiento: DashboardAbastecimiento | null = null;
  logistica: DashboardLogistica | null = null;
  cargando = true;
  error = '';
  desde = '';
  hasta = '';
  pestana: Pestana = 'resumen';

  get esAdmin(): boolean {
    return this.auth.usuario?.rol === 'ADMIN';
  }

  get maxVenta(): number {
    return Math.max(1, ...(this.ventas?.por_canal ?? []).map((x) => Number(x.ingresos) || 0));
  }

  num(valor: string | number | null | undefined): number {
    return Number(valor) || 0;
  }

  entradas(conteos: Record<string, number>): { clave: string; total: number }[] {
    return Object.entries(conteos ?? {}).map(([clave, total]) => ({ clave, total: Number(total) || 0 }));
  }

  ngOnInit(): void {
    const secciones: Record<string, Pestana> = {
      resumen: 'resumen',
      'ventas-productos': 'ventas',
      ventas: 'ventas',
      'produccion-merma': 'produccion',
      produccion: 'produccion',
      abastecimiento: 'abasto',
      abasto: 'abasto',
      'logistica-devoluciones': 'logistica',
      logistica: 'logistica',
    };
    this.ruta.paramMap.subscribe((params) => {
      this.pestana = secciones[params.get('seccion') ?? ''] ?? (this.esAdmin ? 'resumen' : 'produccion');
      if (!this.esAdmin && (this.pestana === 'resumen' || this.pestana === 'ventas')) {
        this.pestana = 'produccion';
      }
      this.error = '';
      this.cargar();
    });
  }

  filtros(): void {
    this.cargar();
  }

  cambiar(pestana: Pestana): void {
    this.pestana = pestana;
    this.error = '';
    const secciones: Record<Pestana, string> = {
      resumen: 'resumen',
      ventas: 'ventas-productos',
      produccion: 'produccion-merma',
      abasto: 'abastecimiento',
      logistica: 'logistica-devoluciones',
    };
    void this.router.navigate(['/panel-admin/dashboard', secciones[pestana]]);
  }

  private get filtro(): { desde?: string; hasta?: string } {
    return { desde: this.desde || undefined, hasta: this.hasta || undefined };
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    const filtro = this.filtro;
    if (this.pestana === 'resumen') {
      this.servicio.resumen(filtro).subscribe({
        next: (respuesta) => {
          this.resumen = respuesta;
          this.cargando = false;
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudo consultar el resumen.');
          this.cargando = false;
        },
      });
      return;
    }
    if (this.pestana === 'ventas') {
      this.servicio.ventas(filtro).subscribe({
        next: (respuesta) => {
          this.ventas = respuesta;
          this.cargando = false;
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudieron consultar las ventas.');
          this.cargando = false;
        },
      });
      return;
    }
    if (this.pestana === 'produccion') {
      this.servicio.produccion(filtro).subscribe({
        next: (respuesta) => {
          this.produccion = respuesta;
          this.cargando = false;
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudo consultar la producción.');
          this.cargando = false;
        },
      });
      return;
    }
    if (this.pestana === 'abasto') {
      this.servicio.abastecimiento(filtro).subscribe({
        next: (respuesta) => {
          this.abastecimiento = respuesta;
          this.cargando = false;
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudo consultar el abastecimiento.');
          this.cargando = false;
        },
      });
      return;
    }
    this.servicio.logistica(filtro).subscribe({
      next: (respuesta) => {
        this.logistica = respuesta;
        this.cargando = false;
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo consultar la logística.');
        this.cargando = false;
      },
    });
  }

  exportar(): void {
    this.error = '';
    this.servicio.exportar(this.filtro).subscribe({
      next: (csv) => descargarTexto(csv, 'dashboard-unique.csv'),
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No fue posible exportar el reporte CSV.');
      },
    });
  }
}
