import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { mensajeError } from '../../core/api/errores';
import { AuthStateService } from '../../core/auth/auth-state.service';
import { PedidoCliente } from '../mispedidos/servicios/mis-pedidos-servicio';
import {
  DevolucionesServicio,
  LineaPedidoDevolucion,
  SolicitudCambioDevolucion,
  TIPOS_SOLICITUD,
  MOTIVOS_SOLICITUD,
} from './servicios/devoluciones-servicio';

export type { SolicitudCambioDevolucion } from './servicios/devoluciones-servicio';

type Seccion = 'solicitar' | 'mis-solicitudes' | 'bandeja' | 'inspeccion';

const TAMANO_MAXIMO_ARCHIVO = 2 * 1024 * 1024;
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];

@Component({
  selector: 'app-cambios-devoluciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cambios-devoluciones.html',
  styles: [],
})
export class CambiosDevoluciones implements OnInit {
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly auth = inject(AuthStateService);
  private readonly servicio = inject(DevolucionesServicio);
  private _solicitudes: SolicitudCambioDevolucion[] = [];

  @Input() set solicitudes(_valor: SolicitudCambioDevolucion[]) {
    // Flask es la fuente de verdad; el padre ya no inyecta datos simulados.
  }
  get solicitudes(): SolicitudCambioDevolucion[] {
    return this._solicitudes;
  }

  @Output() cerrar = new EventEmitter<void>();

  readonly tipos = TIPOS_SOLICITUD;
  readonly motivos = MOTIVOS_SOLICITUD;
  readonly esCliente = this.auth.puede(['CLIENTE']);
  readonly puedeAprobar = this.auth.puede(['ADMIN']);
  readonly puedeOperar = this.auth.puede(['OPERATIVO']);

  seccionActiva: Seccion;
  mensajeAviso = '';
  cargando = true;

  pedidos: PedidoCliente[] = [];
  nuevaSolicitud = {
    pedidoId: 0,
    tipo: 'DEVOLUCION' as 'DEVOLUCION' | 'CAMBIO',
    motivo: 'DEFECTO',
    descripcion: '',
  };
  lineasSolicitud: LineaPedidoDevolucion[] = [];
  evidencias: File[] = [];

  casoEnInspeccion: SolicitudCambioDevolucion | null = null;
  dictamenes: Record<number, 'REINGRESO' | 'MERMA'> = {};

  constructor() {
    this.seccionActiva = this.esCliente ? 'solicitar' : 'bandeja';
  }

  ngOnInit(): void {
    this.cargarSolicitudes();
    if (this.esCliente) {
      const id = Number(this.ruta.snapshot.queryParamMap.get('pedido_id') ?? 0);
      const folio = this.ruta.snapshot.queryParamMap.get('folio');
      this.cargarPedidos(id, folio);
    }
  }

  cargarSolicitudes(): void {
    this.cargando = true;
    this.servicio.listar().subscribe({
      next: (solicitudes) => {
        this._solicitudes = solicitudes;
        if (this.casoEnInspeccion) {
          this.casoEnInspeccion =
            solicitudes.find((item) => item.id === this.casoEnInspeccion?.id) ?? null;
          if (this.casoEnInspeccion) this.inicializarDictamenes(this.casoEnInspeccion);
        }
        this.cargando = false;
      },
      error: (error: unknown) => {
        this.cargando = false;
        this.mensajeAviso = mensajeError(error, 'No fue posible cargar las solicitudes.');
      },
    });
  }

  cargarPedidos(pedidoId = 0, folio: string | null = null): void {
    this.servicio.pedidosEntregados().subscribe({
      next: (pedidos) => {
        this.pedidos = pedidos;
        const elegido =
          (pedidoId ? pedidos.find((pedido) => pedido.id === pedidoId) : undefined) ??
          (folio ? pedidos.find((pedido) => pedido.folio === folio) : undefined);
        if (elegido) this.seleccionarPedido(elegido);
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  cambiarSeccion(seccion: Seccion): void {
    this.seccionActiva = seccion;
    this.mensajeAviso = '';
    if (seccion === 'solicitar') this.cargarPedidos();
  }

  cerrarCasos(): void {
    this.cerrar.emit();
    void this.router.navigate([this.esCliente ? '/catalogo' : '/panel']);
  }

  seleccionarPedido(pedido: PedidoCliente): void {
    this.mensajeAviso = '';
    this.nuevaSolicitud.pedidoId = pedido.id;
    this.servicio.detallePedido(pedido.id).subscribe({
      next: (detalle) => {
        this.lineasSolicitud = detalle.articulos.map((articulo) => ({
          ventaLineaId: articulo.ventaLineaId,
          varianteId: articulo.varianteId,
          productoId: articulo.productoId,
          sku: articulo.sku,
          descripcion: `${articulo.nombre} · ${articulo.colorNombre} · ${articulo.talla}`,
          cantidad: articulo.cantidad,
          cantidadSolicitada: 1,
          varianteCambioId: null,
          opcionesVariante: [],
        }));
        if (this.nuevaSolicitud.tipo === 'CAMBIO') this.cargarVariantes();
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  cambiarTipo(): void {
    this.lineasSolicitud.forEach((linea) => (linea.varianteCambioId = null));
    if (this.nuevaSolicitud.tipo === 'CAMBIO') this.cargarVariantes();
  }

  private cargarVariantes(): void {
    const productos = [...new Set(this.lineasSolicitud.map((linea) => linea.productoId))];
    if (productos.length === 0) return;
    forkJoin(productos.map((productoId) => this.servicio.variantes(productoId))).subscribe({
      next: (grupos) => {
        const porProducto = new Map(productos.map((productoId, indice) => [productoId, grupos[indice]]));
        this.lineasSolicitud.forEach((linea) => {
          linea.opcionesVariante = porProducto.get(linea.productoId) ?? [];
        });
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  onEvidencias(event: Event): void {
    const entrada = event.target as HTMLInputElement;
    const archivos = Array.from(entrada.files ?? []);
    if (archivos.length > 3) {
      this.mensajeAviso = 'Se permiten hasta 3 imágenes de evidencia.';
      entrada.value = '';
      return;
    }
    if (archivos.some((archivo) => !TIPOS_IMAGEN.includes(archivo.type))) {
      this.mensajeAviso = 'Las evidencias deben ser JPG, PNG o WebP.';
      entrada.value = '';
      return;
    }
    if (archivos.some((archivo) => archivo.size > TAMANO_MAXIMO_ARCHIVO)) {
      this.mensajeAviso = 'Cada imagen debe pesar menos de 2 MB.';
      entrada.value = '';
      return;
    }
    this.evidencias = archivos;
    this.mensajeAviso = '';
  }

  enviarSolicitud(): void {
    const seleccionadas = this.lineasSolicitud.filter((linea) => linea.cantidadSolicitada > 0);
    if (!this.nuevaSolicitud.pedidoId) {
      this.mensajeAviso = 'Selecciona un pedido entregado.';
      return;
    }
    if (this.nuevaSolicitud.descripcion.trim().length < 3) {
      this.mensajeAviso = 'Describe el motivo con al menos 3 caracteres.';
      return;
    }
    if (seleccionadas.length === 0) {
      this.mensajeAviso = 'Indica al menos una prenda y cantidad.';
      return;
    }
    if (
      seleccionadas.some(
        (linea) => linea.cantidadSolicitada > linea.cantidad || linea.cantidadSolicitada < 1,
      )
    ) {
      this.mensajeAviso = 'La cantidad solicitada no puede exceder la cantidad comprada.';
      return;
    }
    if (
      this.nuevaSolicitud.tipo === 'CAMBIO' &&
      seleccionadas.some((linea) => !linea.varianteCambioId)
    ) {
      this.mensajeAviso = 'Selecciona la variante de reemplazo en cada línea.';
      return;
    }

    const cuerpo = {
      pedido_id: this.nuevaSolicitud.pedidoId,
      tipo: this.nuevaSolicitud.tipo,
      motivo: this.nuevaSolicitud.motivo,
      descripcion: this.nuevaSolicitud.descripcion.trim(),
      lineas: seleccionadas.map((linea) => ({
        venta_linea_id: linea.ventaLineaId,
        cantidad: linea.cantidadSolicitada,
        variante_cambio_id: this.nuevaSolicitud.tipo === 'CAMBIO' ? linea.varianteCambioId : null,
      })),
    };
    this.servicio.crear(cuerpo, this.evidencias).subscribe({
      next: (creada) => {
        this.mensajeAviso = `Solicitud ${creada.folioCaso} registrada correctamente.`;
        this.nuevaSolicitud.descripcion = '';
        this.evidencias = [];
        this.lineasSolicitud = [];
        this.seccionActiva = 'mis-solicitudes';
        this.cargarSolicitudes();
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  aprobar(caso: SolicitudCambioDevolucion): void {
    this.servicio.aprobar(caso.id).subscribe({
      next: () => {
        this.mensajeAviso = `${caso.folioCaso} aprobada.`;
        this.cargarSolicitudes();
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  rechazar(caso: SolicitudCambioDevolucion): void {
    const motivo = window.prompt('Motivo del rechazo:');
    if (!motivo || motivo.trim().length < 3) return;
    this.servicio.rechazar(caso.id, motivo.trim()).subscribe({
      next: () => {
        this.mensajeAviso = `${caso.folioCaso} rechazada.`;
        this.cargarSolicitudes();
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  recibir(caso: SolicitudCambioDevolucion): void {
    this.servicio.recibir(caso.id).subscribe({
      next: () => {
        this.mensajeAviso = `${caso.folioCaso} recibida; pendiente de dictamen.`;
        this.cargarSolicitudes();
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  abrirInspeccion(caso: SolicitudCambioDevolucion): void {
    this.casoEnInspeccion = caso;
    this.inicializarDictamenes(caso);
    this.seccionActiva = 'inspeccion';
    this.mensajeAviso = '';
  }

  private inicializarDictamenes(caso: SolicitudCambioDevolucion): void {
    this.dictamenes = {};
    caso.lineas
      .filter((linea) => linea.dictamen === 'PENDIENTE')
      .forEach((linea) => (this.dictamenes[linea.id] = 'REINGRESO'));
  }

  guardarDictamen(): void {
    const caso = this.casoEnInspeccion;
    if (!caso) return;
    const lineas = caso.lineas
      .filter((linea) => linea.dictamen === 'PENDIENTE')
      .map((linea) => ({
        devolucion_linea_id: linea.id,
        dictamen: this.dictamenes[linea.id] ?? 'REINGRESO',
      }));
    if (lineas.length === 0) {
      this.mensajeAviso = 'Esta solicitud ya fue dictaminada.';
      return;
    }
    this.servicio.dictaminar(caso.id, lineas, caso.descripcion).subscribe({
      next: () => {
        this.mensajeAviso = `Dictamen de ${caso.folioCaso} registrado.`;
        this.cargarSolicitudes();
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  resolver(caso: SolicitudCambioDevolucion, resolucion: 'REEMBOLSO' | 'CAMBIO'): void {
    this.servicio.resolver(caso.id, resolucion).subscribe({
      next: (resuelta) => {
        this.mensajeAviso = `${resuelta.folioCaso} resuelta por ${resolucion.toLowerCase()}.`;
        this.cargarSolicitudes();
      },
      error: (error: unknown) => (this.mensajeAviso = mensajeError(error)),
    });
  }

  etiqueta(estado: string): string {
    const nombres: Record<string, string> = {
      SOLICITADA: 'Solicitada',
      APROBADA: 'Aprobada',
      RECHAZADA: 'Rechazada',
      RECIBIDA: 'Recibida',
      RESUELTA: 'Resuelta',
    };
    return nombres[estado] ?? estado;
  }
}
