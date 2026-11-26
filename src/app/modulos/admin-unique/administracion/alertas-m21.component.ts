import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { mensajeError } from '../../../core/api/errores';
import { AlertasService, FiltrosAlerta } from '../services/alertas.service';
import { AuthSessionService } from '../services/auth-session.service';
import { AccionAlerta, Alerta, ReglaAlerta } from '../services/ui-admin.models';

type Pestana = 'abiertas' | 'resueltas' | 'reglas';

@Component({
  selector: 'app-alertas-m21',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alertas-m21.component.html',
  styleUrl: '../preparacion/modulos-admin.css',
})
export class AlertasM21Component implements OnInit {
  private readonly servicio = inject(AlertasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthSessionService);

  pestana: Pestana = 'abiertas';
  alertas: Alerta[] = [];
  resueltas: Alerta[] = [];
  reglas: ReglaAlerta[] = [];
  reglasOriginales: ReglaAlerta[] = [];
  filtros: FiltrosAlerta = { estado: 'ABIERTA', severidad: '', tipo: '' };
  cargando = true;
  error = '';
  aviso = '';
  pagina = 1;
  porPagina = 20;
  total = 0;
  detalle: Alerta | null = null;

  get esAdmin(): boolean {
    return this.auth.usuario?.rol === 'ADMIN';
  }

  /** `AlertaFiltrosSchema` rechaza paginación; se conserva la primera página del servidor. */
  get totalPaginas(): number {
    return 1;
  }

  get criticas(): number {
    return this.alertas.filter((a) => a.severidad === 'CRITICA').length;
  }

  get preventivas(): number {
    return this.alertas.filter((a) => a.severidad === 'PREVENTIVA').length;
  }

  get informativas(): number {
    return this.alertas.filter((a) => a.severidad === 'INFORMATIVA').length;
  }

  ngOnInit(): void {
    const secciones: Record<string, Pestana> = {
      bandeja: 'abiertas',
      abiertas: 'abiertas',
      resueltas: 'resueltas',
      reglas: 'reglas',
    };
    this.ruta.paramMap.subscribe((params) => {
      this.pestana = secciones[params.get('seccion') ?? ''] ?? 'abiertas';
      if (this.pestana === 'reglas' && !this.esAdmin) this.pestana = 'abiertas';
      this.error = '';
      this.aviso = '';
      this.detalle = null;
      if (this.pestana === 'abiertas') this.cargar();
      if (this.pestana === 'resueltas') this.cargarResueltas();
      if (this.pestana === 'reglas') this.cargarReglas();
    });
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.servicio
      .listar({
        estado: this.filtros.estado || undefined,
        tipo: this.filtros.tipo || undefined,
        severidad: this.filtros.severidad || undefined,
      })
      .subscribe({
        next: (respuesta) => {
          this.alertas = respuesta.items;
          this.total = respuesta.total;
          this.pagina = respuesta.pagina;
          this.porPagina = respuesta.por_pagina;
          this.cargando = false;
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No fue posible consultar las alertas.');
          this.cargando = false;
        },
      });
  }

  cargarResueltas(): void {
    this.cargando = true;
    this.error = '';
    this.servicio
      .resueltas({
        tipo: this.filtros.tipo || undefined,
        severidad: this.filtros.severidad || undefined,
      })
      .subscribe({
        next: (respuesta) => {
          this.resueltas = respuesta.items;
          this.total = respuesta.total;
          this.pagina = respuesta.pagina;
          this.cargando = false;
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudo cargar la bitácora de alertas.');
          this.cargando = false;
        },
      });
  }

  cargarReglas(): void {
    if (!this.esAdmin) return;
    this.servicio.reglas().subscribe({
      next: (reglas) => {
        this.reglas = reglas;
        this.reglasOriginales = reglas.map((r) => ({ ...r }));
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudieron cargar las reglas.');
      },
    });
  }

  cambiar(pestana: Pestana): void {
    this.pestana = pestana;
    this.pagina = 1;
    this.error = '';
    this.aviso = '';
    const secciones: Record<Pestana, string> = {
      abiertas: 'bandeja',
      resueltas: 'resueltas',
      reglas: 'reglas',
    };
    void this.router.navigate(['/panel-admin/alertas', secciones[pestana]]);
  }

  cambiarPagina(delta: number): void {
    const destino = this.pagina + delta;
    if (destino < 1 || destino > this.totalPaginas) return;
    this.pagina = destino;
    if (this.pestana === 'abiertas') this.cargar();
    if (this.pestana === 'resueltas') this.cargarResueltas();
  }

  accion(alerta: Alerta): AccionAlerta {
    return this.servicio.accionSugerida(alerta);
  }

  etiquetaAccion(alerta: Alerta): string {
    const nombres: Record<AccionAlerta, string> = {
      ATENDER: 'Atender',
      GENERAR_PRODUCCION: 'Generar producción',
      GENERAR_REQUISICION: 'Generar requisición',
      EVALUAR_PROVEEDOR: 'Evaluar proveedor',
    };
    return nombres[this.accion(alerta)];
  }

  ejecutar(alerta: Alerta): void {
    const accion = this.accion(alerta);
    if (!confirm(`¿Ejecutar "${accion}" sobre la alerta ${alerta.id}?`)) return;
    this.error = '';
    this.servicio.ejecutarAccion(alerta.id, accion).subscribe({
      next: () => {
        this.aviso = 'Acción ejecutada. La alerta quedó atendida.';
        this.detalle = null;
        this.cargar();
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo ejecutar la acción.');
      },
    });
  }

  ver(alerta: Alerta): void {
    this.detalle = alerta;
    this.error = '';
  }

  guardarReglas(): void {
    if (!this.esAdmin) return;
    const invalida = this.reglas.find((r) => !/^\d+(\.\d+)?$/.test(r.valor ?? ''));
    if (invalida) {
      this.error = `El valor de "${invalida.clave}" debe ser numérico.`;
      return;
    }
    if (!this.reglas.some((r, i) => r.valor !== this.reglasOriginales[i]?.valor)) {
      this.aviso = 'No hay cambios en las reglas.';
      return;
    }
    this.error = '';
    this.servicio
      .actualizarReglas(
        this.reglas
          .filter((r, i) => r.valor !== this.reglasOriginales[i]?.valor)
          .map((r) => ({ clave: r.clave, valor: String(r.valor) })),
      )
      .subscribe({
        next: (reglas) => {
          this.reglas = reglas;
          this.reglasOriginales = reglas.map((r) => ({ ...r }));
          this.aviso = 'Reglas actualizadas.';
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudieron guardar las reglas.');
        },
      });
  }
}
