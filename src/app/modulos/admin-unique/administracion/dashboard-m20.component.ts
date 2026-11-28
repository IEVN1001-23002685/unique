import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../../core/api/errores';
import { AlertasService } from '../services/alertas.service';
import { DashboardService } from '../services/dashboard.service';
import { descargarTexto } from '../services/descargas';
import { AuthSessionService } from '../services/auth-session.service';
import {
  Alerta,
  DashboardAbastecimiento,
  DashboardLogistica,
  DashboardProduccion,
  DashboardResumen,
  DashboardVentas,
} from '../services/ui-admin.models';

type Pestana = 'resumen' | 'ventas' | 'produccion' | 'abasto' | 'logistica';

interface FilaValor {
  etiqueta: string;
  valor: number;
}

interface Conteo {
  clave: string;
  total: number;
}

interface SkuAgrupado {
  sku: string;
  nombre_producto: string;
  categoria: string;
  talla: string;
  color: string;
  unidades: number;
  ingresos: number;
}

interface OpcionSku {
  sku: string;
  etiqueta: string;
}

@Component({
  selector: 'app-dashboard-m20',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard-m20.component.html',
  styleUrls: ['../preparacion/modulos-admin.css', './dashboard-m20.css'],
})
export class DashboardM20Component implements OnInit {
  private readonly servicio = inject(DashboardService);
  private readonly alertasServicio = inject(AlertasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private solicitud = 0;

  readonly auth = inject(AuthSessionService);

  resumen: DashboardResumen | null = null;
  ventas: DashboardVentas | null = null;
  produccion: DashboardProduccion | null = null;
  abastecimiento: DashboardAbastecimiento | null = null;
  logistica: DashboardLogistica | null = null;

  criticas: Alerta[] = [];
  criticasAbiertas = 0;
  errorAlertas = '';

  cargando = true;
  error = '';
  desde = '';
  hasta = '';

  filtroCategoria = '';
  filtroProducto = '';
  filtroColor = '';
  filtroTalla = '';
  filtroCanal = 'TODOS';

  pestana: Pestana = 'resumen';

  get esAdmin(): boolean {
    return this.auth.usuario?.rol === 'ADMIN';
  }

  get tienePeriodo(): boolean {
    return Boolean(this.servicio.desde() || this.servicio.hasta());
  }

  get criticasVisibles(): Alerta[] {
    return this.criticas.slice(0, 3);
  }

  get ordenesRojas(): number {
    return this.criticas.filter((alerta) => alerta.tipo === 'ORDEN_ROJA').length;
  }

  private get filasSku(): DashboardVentas['top_sku'] {
    return this.ventas?.top_sku ?? [];
  }

  get categoriasDetalle(): string[] {
    return this.opciones(this.filasSku.map((fila) => fila.categoria || 'Sin categoría'));
  }

  get productosDetalle(): OpcionSku[] {
    const filas = this.filtroCategoria
      ? this.filasSku.filter((fila) => (fila.categoria || 'Sin categoría') === this.filtroCategoria)
      : this.filasSku;
    const mapa = new Map<string, string>();
    for (const fila of filas) {
      mapa.set(fila.sku, `${fila.nombre_producto} · ${fila.sku}`);
    }
    return [...mapa.entries()]
      .map(([sku, etiqueta]) => ({ sku, etiqueta }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es-MX'));
  }

  get coloresDetalle(): string[] {
    return this.opciones(this.filasSku.map((fila) => fila.color));
  }

  get tallasDetalle(): string[] {
    return this.opciones(this.filasSku.map((fila) => fila.talla));
  }

  get canalesDetalle(): string[] {
    return this.opciones((this.ventas?.por_canal ?? []).map((canal) => canal.canal));
  }

  get hayFiltrosDetalle(): boolean {
    return Boolean(
      this.filtroCategoria || this.filtroProducto || this.filtroColor || this.filtroTalla ||
        (this.filtroCanal && this.filtroCanal !== 'TODOS'),
    );
  }

  get skusFiltrados(): DashboardVentas['top_sku'] {
    return this.filasSku.filter(
      (fila) =>
        (!this.filtroCategoria ||
          (fila.categoria || 'Sin categoría') === this.filtroCategoria) &&
        (!this.filtroProducto || fila.sku === this.filtroProducto) &&
        (!this.filtroColor || fila.color === this.filtroColor) &&
        (!this.filtroTalla || fila.talla === this.filtroTalla),
    );
  }

  get skusAgrupados(): SkuAgrupado[] {
    const mapa = new Map<string, SkuAgrupado>();
    for (const fila of this.skusFiltrados) {
      const actual = mapa.get(fila.sku) ?? {
        sku: fila.sku,
        nombre_producto: fila.nombre_producto,
        categoria: fila.categoria || 'Sin categoría',
        talla: fila.talla,
        color: fila.color,
        unidades: 0,
        ingresos: 0,
      };
      actual.unidades += this.num(fila.unidades);
      actual.ingresos += this.num(fila.ingresos);
      mapa.set(fila.sku, actual);
    }
    return [...mapa.values()].sort((a, b) => b.ingresos - a.ingresos);
  }

  get masVendidos(): SkuAgrupado[] {
    return [...this.skusAgrupados].sort((a, b) => b.unidades - a.unidades).slice(0, 5);
  }

  get menosVendidos(): SkuAgrupado[] {
    return [...this.skusAgrupados].sort((a, b) => a.unidades - b.unidades).slice(0, 5);
  }

  get canalesFiltrados(): DashboardVentas['por_canal'] {
    const canales = this.ventas?.por_canal ?? [];
    return this.filtroCanal === 'TODOS'
      ? canales
      : canales.filter((canal) => canal.canal === this.filtroCanal);
  }

  get ventasPorMes(): FilaValor[] {
    const mapa = new Map<string, number>();
    for (const fila of this.skusFiltrados) {
      const clave = (fila.fecha || '').slice(0, 7);
      if (!clave) continue;
      mapa.set(clave, (mapa.get(clave) ?? 0) + this.num(fila.ingresos));
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, valor]) => ({ etiqueta: this.etiquetaMes(clave), valor }));
  }

  get ingresosPorCategoria(): FilaValor[] {
    return this.agrupar(
      this.skusAgrupados.map((sku) => ({ etiqueta: sku.categoria, valor: sku.ingresos })),
    );
  }

  get ingresosPorColor(): FilaValor[] {
    return this.agrupar(
      this.skusAgrupados.map((sku) => ({ etiqueta: sku.color || 'Sin color', valor: sku.ingresos })),
    );
  }

  get ingresosPorTalla(): FilaValor[] {
    return this.agrupar(
      this.skusAgrupados.map((sku) => ({ etiqueta: sku.talla || 'Sin talla', valor: sku.ingresos })),
    );
  }

  get maxBarra(): number {
    return Math.max(
      1,
      ...this.ventasPorMes.map((fila) => fila.valor),
      ...this.canalesFiltrados.map((canal) => this.num(canal.ingresos)),
    );
  }

  get cumplimientoPlan(): number {
    const planeadas = this.num(this.produccion?.unidades_planeadas);
    return this.porcentaje(this.num(this.produccion?.unidades_aprobadas), planeadas);
  }

  /** Aproximación visible: Flask aún no expone la merma dentro del payload de producción. */
  get tasaReproceso(): number {
    const aprobadas = this.num(this.produccion?.unidades_aprobadas);
    const reproceso = this.num(this.produccion?.unidades_reproceso);
    return this.porcentaje(reproceso, aprobadas + reproceso);
  }

  private get filtro(): { desde?: string; hasta?: string } {
    return this.servicio.filtros();
  }

  ngOnInit(): void {
    this.cargarAlertas();
    const consulta = this.ruta.snapshot.queryParamMap;
    if (consulta.has('desde') || consulta.has('hasta')) {
      this.servicio.establecerPeriodo(consulta.get('desde'), consulta.get('hasta'));
    }
    this.desde = this.servicio.desde();
    this.hasta = this.servicio.hasta();
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
    this.ruta.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.pestana = secciones[params.get('seccion') ?? ''] ?? (this.esAdmin ? 'resumen' : 'produccion');
      if (!this.esAdmin && (this.pestana === 'resumen' || this.pestana === 'ventas')) {
        this.pestana = 'produccion';
      }
      this.error = '';
      this.cargar();
    });
  }

  private cargarAlertas(): void {
    this.alertasServicio.listar({ estado: 'ABIERTA', severidad: 'CRITICA' }).subscribe({
      next: (respuesta) => {
        this.criticas = respuesta.items;
        this.criticasAbiertas = respuesta.total;
      },
      error: (error: unknown) => {
        this.errorAlertas = mensajeError(error, 'No se pudieron consultar las alertas críticas.');
      },
    });
  }

  filtros(): void {
    this.servicio.establecerPeriodo(this.desde, this.hasta);
    this.desde = this.servicio.desde();
    this.hasta = this.servicio.hasta();
    this.sincronizarUrl();
    this.cargar();
  }

  limpiarPeriodo(): void {
    this.desde = '';
    this.hasta = '';
    this.servicio.limpiarPeriodo();
    this.sincronizarUrl();
    this.cargar();
  }

  private sincronizarUrl(): void {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: {
        desde: this.servicio.desde() || null,
        hasta: this.servicio.hasta() || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  alCambiarCategoria(): void {
    if (
      this.filtroProducto &&
      !this.productosDetalle.some((producto) => producto.sku === this.filtroProducto)
    ) {
      this.filtroProducto = '';
    }
  }

  limpiarFiltrosDetalle(): void {
    this.filtroCategoria = '';
    this.filtroProducto = '';
    this.filtroColor = '';
    this.filtroTalla = '';
    this.filtroCanal = 'TODOS';
  }

  cambiar(pestana: Pestana): void {
    const destination = !this.esAdmin && (pestana === 'resumen' || pestana === 'ventas')
      ? 'produccion'
      : pestana;
    this.pestana = destination;
    this.error = '';
    const secciones: Record<Pestana, string> = {
      resumen: 'resumen',
      ventas: 'ventas-productos',
      produccion: 'produccion-merma',
      abasto: 'abastecimiento',
      logistica: 'logistica-devoluciones',
    };
    void this.router.navigate(['/panel-admin/dashboard', secciones[destination]], {
      queryParams: {
        desde: this.servicio.desde() || null,
        hasta: this.servicio.hasta() || null,
      },
    });
  }

  reintentar(): void {
    this.cargar();
  }

  cargar(): void {
    const id = ++this.solicitud;
    this.cargando = true;
    this.error = '';
    const filtro = this.filtro;

    if (this.pestana === 'resumen') {
      this.servicio.resumen(filtro).subscribe({
        next: (respuesta) => {
          if (id !== this.solicitud) return;
          this.resumen = respuesta;
          this.cargando = false;
        },
        error: (error: unknown) => {
          if (id !== this.solicitud) return;
          this.error = mensajeError(error, 'No se pudo consultar el resumen.');
          this.cargando = false;
        },
      });
      return;
    }

    if (this.pestana === 'ventas') {
      // El resumen es complementario: si falla, el detalle de ventas sigue siendo util.
      this.servicio.resumen(filtro).subscribe({
        next: (respuesta) => {
          if (id === this.solicitud) this.resumen = respuesta;
        },
        error: () => {
          if (id === this.solicitud) this.resumen = null;
        },
      });
      this.servicio.ventas(filtro).subscribe({
        next: (respuesta) => {
          if (id !== this.solicitud) return;
          this.ventas = respuesta;
          this.cargando = false;
        },
        error: (error: unknown) => {
          if (id !== this.solicitud) return;
          this.error = mensajeError(error, 'No se pudieron consultar las ventas.');
          this.cargando = false;
        },
      });
      return;
    }

    if (this.pestana === 'produccion') {
      this.servicio.produccion(filtro).subscribe({
        next: (respuesta) => {
          if (id !== this.solicitud) return;
          this.produccion = respuesta;
          this.cargando = false;
        },
        error: (error: unknown) => {
          if (id !== this.solicitud) return;
          this.error = mensajeError(error, 'No se pudo consultar la producción.');
          this.cargando = false;
        },
      });
      return;
    }

    if (this.pestana === 'abasto') {
      this.servicio.abastecimiento(filtro).subscribe({
        next: (respuesta) => {
          if (id !== this.solicitud) return;
          this.abastecimiento = respuesta;
          this.cargando = false;
        },
        error: (error: unknown) => {
          if (id !== this.solicitud) return;
          this.error = mensajeError(error, 'No se pudo consultar el abastecimiento.');
          this.cargando = false;
        },
      });
      return;
    }

    this.servicio.logistica(filtro).subscribe({
      next: (respuesta) => {
        if (id !== this.solicitud) return;
        this.logistica = respuesta;
        this.cargando = false;
      },
      error: (error: unknown) => {
        if (id !== this.solicitud) return;
        this.error = mensajeError(error, 'No se pudo consultar la logística.');
        this.cargando = false;
      },
    });
  }

  exportar(): void {
    if (!this.esAdmin) return;
    this.error = '';
    this.servicio.exportar(this.filtro).subscribe({
      next: (csv) => descargarTexto(csv, 'dashboard-unique.csv'),
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No fue posible exportar el reporte CSV.');
      },
    });
  }

  num(valor: string | number | null | undefined): number {
    return Number(valor) || 0;
  }

  porcentaje(parte: number, total: number): number {
    return total > 0 ? (parte / total) * 100 : 0;
  }

  anchoBarra(valor: number): number {
    return Math.max(0, Math.min(100, this.porcentaje(valor, this.maxBarra)));
  }

  etiquetaMes(clave: string): string {
    const fecha = new Date(`${clave}-01T12:00:00`);
    return Number.isNaN(fecha.getTime())
      ? clave
      : new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' }).format(fecha);
  }

  entradas(conteos: Record<string, number> | null | undefined): Conteo[] {
    return Object.entries(conteos ?? {})
      .map(([clave, total]) => ({ clave, total: this.num(total) }))
      .sort((a, b) => b.total - a.total);
  }

  estadoClase(clave: string): string {
    const valor = clave.toUpperCase();
    if (['ROJO', 'AGOTADO', 'CANCELADO', 'FALLIDO', 'VENCIDO', 'CRITICA'].some((k) => valor.includes(k))) {
      return 'red';
    }
    if (['AMBAR', 'PENDIENTE', 'RETRASADA', 'PREVENTIVA', 'ESPERA'].some((k) => valor.includes(k))) {
      return 'amber';
    }
    if (['VERDE', 'ENTREGADO', 'APROBADO', 'LISTO', 'RESUELTO'].some((k) => valor.includes(k))) {
      return 'green';
    }
    if (['INFORMATIVA', 'CAMINO', 'REPARTO'].some((k) => valor.includes(k))) {
      return 'blue';
    }
    return 'gray';
  }

  private opciones(valores: (string | null | undefined)[]): string[] {
    return [...new Set(valores.filter((valor): valor is string => Boolean(valor && valor.trim())))]
      .sort((a, b) => a.localeCompare(b, 'es-MX'));
  }

  private agrupar(filas: FilaValor[]): FilaValor[] {
    const mapa = new Map<string, number>();
    for (const fila of filas) {
      mapa.set(fila.etiqueta, (mapa.get(fila.etiqueta) ?? 0) + fila.valor);
    }
    return [...mapa.entries()]
      .map(([etiqueta, valor]) => ({ etiqueta, valor }))
      .sort((a, b) => b.valor - a.valor);
  }
}
