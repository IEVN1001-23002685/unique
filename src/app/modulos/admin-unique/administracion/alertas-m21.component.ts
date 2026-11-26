import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../../core/api/errores';
import { AlertasService, FiltrosAlerta } from '../services/alertas.service';
import { AuthSessionService } from '../services/auth-session.service';
import { AccionAlerta, Alerta, ReglaAlerta } from '../services/ui-admin.models';

type Pestana = 'abiertas' | 'resueltas' | 'reglas';
type SeveridadTab = 'TODAS' | 'CRITICA' | 'PREVENTIVA' | 'INFORMATIVA';

interface DestinoAlerta {
  ruta: string;
  etiqueta: string;
}

/** Botones «ver origen» del catálogo de M21; las acciones que sí escriben siguen en AlertasService. */
const DESTINOS: Record<string, DestinoAlerta> = {
  ORDEN_ROJA: { ruta: '/produccion', etiqueta: 'Ver orden' },
  OC_RETRASADA: { ruta: '/compras/ordenes', etiqueta: 'Ver orden de compra' },
  PEDIDO_ESTANCADO: { ruta: '/admin/pedidos', etiqueta: 'Ver pedido' },
  MERMA_ALTA: { ruta: '/mermas/indicadores', etiqueta: 'Ver indicador' },
  DIFERENCIA_CONTEO: { ruta: '/operacion/inventario-pt', etiqueta: 'Ver detalle' },
  ENTREGA_FALLIDA: {
    ruta: '/panel-admin/entregas/seguimiento',
    etiqueta: 'Reprogramar o cancelar',
  },
  DEVOLUCION_PENDIENTE: { ruta: '/operacion/devoluciones', etiqueta: 'Abrir devolución' },
  PAGO_PENDIENTE: { ruta: '/ventas', etiqueta: 'Validar pago' },
  PROVEEDOR_EN_REVISION: { ruta: '/proveedores/evaluacion', etiqueta: 'Ver proveedor' },
  DISENO_PENDIENTE: { ruta: '/admin/recetas/disenos', etiqueta: 'Abrir diseño' },
};

@Component({
  selector: 'app-alertas-m21',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './alertas-m21.component.html',
  styleUrls: ['../preparacion/modulos-admin.css', './alertas-m21.css'],
})
export class AlertasM21Component implements OnInit {
  private readonly servicio = inject(AlertasService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthSessionService);

  pestana: Pestana = 'abiertas';
  severidadTab: SeveridadTab = 'TODAS';
  alertasAbiertas: Alerta[] = [];
  resueltas: Alerta[] = [];
  reglas: ReglaAlerta[] = [];
  reglasOriginales: ReglaAlerta[] = [];

  filtros: FiltrosAlerta = { estado: 'ABIERTA', tipo: '' };
  cargando = true;
  guardando = false;
  error = '';
  aviso = '';
  total = 0;
  detalle: Alerta | null = null;
  confirmacion: Alerta | null = null;

  get esAdmin(): boolean {
    return this.auth.usuario?.rol === 'ADMIN';
  }

  /** Los contadores salen de la página cargada; Flask no acepta paginación en /alertas. */
  get criticas(): number {
    return this.alertasAbiertas.filter((alerta) => alerta.severidad === 'CRITICA').length;
  }

  get preventivas(): number {
    return this.alertasAbiertas.filter((alerta) => alerta.severidad === 'PREVENTIVA').length;
  }

  get informativas(): number {
    return this.alertasAbiertas.filter((alerta) => alerta.severidad === 'INFORMATIVA').length;
  }

  get alertas(): Alerta[] {
    return this.alertasAbiertas.filter(
      (alerta) =>
        (!this.filtros.tipo || alerta.tipo === this.filtros.tipo) &&
        (this.severidadTab === 'TODAS' || alerta.severidad === this.severidadTab),
    );
  }

  get hayMasRegistros(): boolean {
    return this.total > this.alertasAbiertas.length;
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
      this.confirmacion = null;
      if (this.pestana === 'abiertas') this.cargar();
      if (this.pestana === 'resueltas') this.cargarResueltas();
      if (this.pestana === 'reglas') this.cargarReglas();
    });
  }

  private visible(alerta: Alerta): boolean {
    if (this.esAdmin) return true;
    const destino = (alerta.rol_destino || '').toUpperCase();
    if (!destino) return true;
    return (
      destino.includes('OPERATIVO') || destino.includes('AMBOS') || destino.includes('TODOS')
    );
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.servicio.listar({ estado: 'ABIERTA' }).subscribe({
      next: (respuesta) => {
        this.alertasAbiertas = respuesta.items.filter((alerta) => this.visible(alerta));
        this.total = respuesta.total;
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
      .resueltas({ tipo: this.filtros.tipo || undefined })
      .subscribe({
        next: (respuesta) => {
          this.resueltas = respuesta.items.filter((alerta) => this.visible(alerta));
          this.total = respuesta.total;
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
    this.cargando = true;
    this.error = '';
    this.servicio.reglas().subscribe({
      next: (reglas) => {
        this.reglas = reglas;
        this.reglasOriginales = reglas.map((regla) => ({ ...regla }));
        this.cargando = false;
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudieron cargar las reglas.');
        this.cargando = false;
      },
    });
  }

  reintentar(): void {
    if (this.pestana === 'resueltas') this.cargarResueltas();
    else if (this.pestana === 'reglas') this.cargarReglas();
    else this.cargar();
  }

  cambiar(pestana: Pestana): void {
    if (pestana === 'reglas' && !this.esAdmin) pestana = 'abiertas';
    this.pestana = pestana;
    this.error = '';
    this.aviso = '';
    this.detalle = null;
    this.confirmacion = null;
    const secciones: Record<Pestana, string> = {
      abiertas: 'bandeja',
      resueltas: 'resueltas',
      reglas: 'reglas',
    };
    void this.router.navigate(['/panel-admin/alertas', secciones[pestana]]);
  }

  cambiarSeveridad(tab: SeveridadTab): void {
    this.severidadTab = tab;
    this.detalle = null;
    this.confirmacion = null;
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

  destino(tipo: string): DestinoAlerta | null {
    return DESTINOS[tipo] ?? null;
  }

  etiquetaBoton(alerta: Alerta): string {
    return this.destino(alerta.tipo)?.etiqueta ?? this.etiquetaAccion(alerta);
  }

  pedirConfirmacion(alerta: Alerta): void {
    if (this.destino(alerta.tipo)) return;
    this.confirmacion = alerta;
    this.error = '';
  }

  cancelarAccion(): void {
    this.confirmacion = null;
  }

  confirmarAccion(): void {
    const alerta = this.confirmacion;
    if (!alerta) return;
    const accion = this.accion(alerta);
    this.confirmacion = null;
    this.error = '';
    this.servicio.ejecutarAccion(alerta.id, accion).subscribe({
      next: () => {
        this.aviso = `Acción «${accion}» enviada. Flask marcó la alerta como atendida.`;
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

  tiempoAbierta(alerta: Alerta): string {
    if (!alerta.creado_en) return '—';
    const fecha = new Date(alerta.creado_en);
    if (Number.isNaN(fecha.getTime())) return '—';
    const minutos = Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 60_000));
    if (minutos < 1) return 'hace un momento';
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    if (horas < 24) return `hace ${horas} h${resto ? ` ${resto} min` : ''}`;
    const dias = Math.floor(horas / 24);
    return `hace ${dias} d ${horas % 24} h`;
  }

  nombreAtencion(alerta: Alerta): string {
    return alerta.atendida_por ? `Usuario #${alerta.atendida_por}` : 'Sistema';
  }

  guardarReglas(): void {
    if (!this.esAdmin || this.guardando) return;
    const invalida = this.reglas.find((regla) => !/^\d+(\.\d+)?$/.test(regla.valor ?? ''));
    if (invalida) {
      this.error = `El valor de "${invalida.clave}" debe ser numérico.`;
      return;
    }
    if (!this.reglas.some((regla, i) => regla.valor !== this.reglasOriginales[i]?.valor)) {
      this.aviso = 'No hay cambios en las reglas.';
      return;
    }
    this.error = '';
    this.guardando = true;
    this.servicio
      .actualizarReglas(
        this.reglas
          .filter((regla, i) => regla.valor !== this.reglasOriginales[i]?.valor)
          .map((regla) => ({ clave: regla.clave, valor: String(regla.valor) })),
      )
      .subscribe({
        next: (reglas) => {
          this.reglas = reglas;
          this.reglasOriginales = reglas.map((regla) => ({ ...regla }));
          this.aviso = 'Reglas actualizadas.';
          this.guardando = false;
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudieron guardar las reglas.');
          this.guardando = false;
        },
      });
  }
}
