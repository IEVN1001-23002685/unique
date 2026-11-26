import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AvisoToast } from '../../compartido/componentes/aviso-toast/aviso-toast';
import { mensajeError } from '../../core/api/errores';
import { formatearFecha, formatearFechaHora } from '../../core/api/formato';
import { AvisosServicio } from '../../nucleo/servicios/avisos-servicio';
import {
  DIAS_DEVOLUCION,
  ESTADOS_CANCELABLES,
  FILTROS_ESTADO,
  PASOS_ESTADO,
  MisPedidosServicio,
  etiquetaEstado,
} from './servicios/mis-pedidos-servicio';
import type { PedidoCliente } from './servicios/mis-pedidos-servicio';

export type {
  ArticuloPedido,
  ComprobantePedido,
  PasoSeguimientoPedido,
  PedidoCliente,
} from './servicios/mis-pedidos-servicio';
export { etiquetaEstado } from './servicios/mis-pedidos-servicio';

interface PasoLineaTiempo {
  codigo: string;
  etiqueta: string;
  estado: 'completado' | 'en-curso' | 'pendiente';
  fecha: string;
  descripcion: string;
  fechaEstimada: string | null;
}

interface EventoNotificacion {
  titulo: string;
  fecha: string;
  descripcion: string;
}

type AccionPedido = 'guia' | 'devolucion' | 'seguimiento';

@Component({
  selector: 'app-mis-pedidos',
  standalone: true,
  imports: [AvisoToast, CurrencyPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './mispedidos.html',
  styleUrl: './mispedidos.css',
})
export class MisPedidos {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(MisPedidosServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly fb = inject(FormBuilder);

  readonly filtros = FILTROS_ESTADO;
  readonly diasDevolucion = DIAS_DEVOLUCION;
  readonly etiquetaEstado = etiquetaEstado;
  readonly formatearFecha = formatearFecha;
  readonly formatearFechaHora = formatearFechaHora;

  readonly busqueda = new FormControl('', { nonNullable: true });
  private readonly consulta = toSignal(this.busqueda.valueChanges, { initialValue: '' });

  readonly cancelacionForm = this.fb.nonNullable.group({
    motivo: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly filtro = signal('TODOS');
  readonly pedidos = signal<PedidoCliente[]>([]);
  readonly detalle = signal<PedidoCliente | null>(null);
  readonly idSolicitado = signal<number | null>(null);
  readonly cargando = signal(true);
  readonly detalleCargando = signal(false);
  readonly actualizando = signal(false);
  readonly cancelando = signal(false);
  readonly descargando = signal(false);
  readonly error = signal('');
  readonly ultimaActualizacion = signal<Date | null>(null);
  readonly imagenesFallidas = signal<number[]>([]);
  readonly guiaPedido = signal<PedidoCliente | null>(null);
  readonly pedidoACancelar = signal<PedidoCliente | null>(null);

  readonly pedidosFiltrados = computed(() => {
    const consulta = this.consulta().trim().toLowerCase();
    return this.pedidos().filter(
      (pedido) =>
        (!consulta || pedido.folio.toLowerCase().includes(consulta)) &&
        this.coincideFiltro(pedido, this.filtro()),
    );
  });

  readonly lineaTiempo = computed<PasoLineaTiempo[]>(() => {
    const pedido = this.detalle();
    if (!pedido) return [];

    const pasos: PasoLineaTiempo[] = [];
    for (const paso of PASOS_ESTADO) {
      if (
        paso.codigo === 'EN_PRODUCCION' &&
        !pedido.seguimiento.some((evento) => evento.codigo === 'EN_PRODUCCION') &&
        pedido.estado !== 'EN_PRODUCCION'
      ) {
        continue;
      }

      const codigos =
        paso.codigo === 'LISTO_ENVIO' ? ['LISTO_ENVIO', 'EN_PREPARACION'] : [paso.codigo];
      const evento = pedido.seguimiento.find((item) => codigos.includes(item.codigo));
      const fechaEstimada = paso.codigo === 'EN_PRODUCCION' ? pedido.fechaEstimada : null;
      const verificacionEnCurso =
        paso.codigo === 'LISTO_ENVIO' && pedido.estado === 'EN_PREPARACION';
      const produccionEnCurso =
        paso.codigo === 'EN_PRODUCCION' && pedido.estado === 'EN_PRODUCCION';
      const enCurso = verificacionEnCurso || produccionEnCurso;

      pasos.push({
        codigo: paso.codigo,
        etiqueta: paso.etiqueta,
        estado: enCurso ? 'en-curso' : evento ? 'completado' : 'pendiente',
        fecha: enCurso
          ? 'En curso'
          : evento
            ? formatearFechaHora(evento.fecha)
            : 'Pendiente',
        descripcion: verificacionEnCurso
          ? 'Verificado en curso'
          : evento?.codigo === 'LISTO_ENVIO'
            ? 'Verificado completado'
            : enCurso
              ? 'Etapa actual del pedido'
              : evento?.descripcion || 'Aún sin registro visible',
        fechaEstimada,
      });
    }
    return pasos;
  });

  readonly notificaciones = computed<EventoNotificacion[]>(() =>
    (this.detalle()?.seguimiento ?? []).map((evento) => ({
      titulo: evento.estado,
      fecha: formatearFechaHora(evento.fecha),
      descripcion: evento.descripcion,
    })),
  );

  constructor() {
    this.ruta.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const id = Number(parametros.get('id'));
      if (Number.isInteger(id) && id > 0) {
        this.idSolicitado.set(id);
        this.cargarDetalle(id);
        return;
      }
      this.idSolicitado.set(null);
      this.detalle.set(null);
      this.cargarLista();
    });

    // §7 M06: la pantalla se actualiza cada 30 segundos sin escribir datos.
    interval(30_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.actualizar());
  }

  protected cambiarFiltro(valor: string): void {
    if (this.filtro() === valor) return;
    this.filtro.set(valor);
    this.cargarLista();
  }

  protected verSeguimiento(pedido: PedidoCliente): void {
    void this.router.navigate(['/pedidos', pedido.id]);
  }

  protected volverALista(): void {
    void this.router.navigate(['/pedidos']);
  }

  protected accionPedido(pedido: PedidoCliente): AccionPedido {
    if (pedido.estado === 'EN_REPARTO') return 'guia';
    if (this.puedeSolicitarDevolucion(pedido)) return 'devolucion';
    return 'seguimiento';
  }

  protected abrirGuia(pedido: PedidoCliente): void {
    this.guiaPedido.set(pedido);
  }

  protected cerrarGuia(): void {
    this.guiaPedido.set(null);
  }

  protected puedeCancelar(pedido: PedidoCliente): boolean {
    return (ESTADOS_CANCELABLES as readonly string[]).includes(pedido.estado);
  }

  protected puedeSolicitarDevolucion(pedido: PedidoCliente): boolean {
    return pedido.estado === 'ENTREGADO' && this.diasRestantes(pedido) > 0;
  }

  protected diasRestantes(pedido: PedidoCliente): number {
    const referencia = pedido.fechaEntrega ?? pedido.fecha;
    if (!referencia) return 0;
    const fecha = new Date(referencia);
    if (Number.isNaN(fecha.getTime())) return 0;
    const limite = fecha.getTime() + DIAS_DEVOLUCION * 86_400_000;
    return Math.max(0, Math.ceil((limite - Date.now()) / 86_400_000));
  }

  protected solicitarCambio(pedido: PedidoCliente): void {
    void this.router.navigate(['/devoluciones'], {
      queryParams: { pedido_id: pedido.id, folio: pedido.folio },
    });
  }

  protected abrirCancelacion(pedido: PedidoCliente): void {
    if (!this.puedeCancelar(pedido)) return;
    this.cancelacionForm.reset();
    this.pedidoACancelar.set(pedido);
  }

  protected cerrarCancelacion(): void {
    this.pedidoACancelar.set(null);
    this.cancelacionForm.reset();
  }

  protected confirmarCancelacion(): void {
    const pedido = this.pedidoACancelar();
    if (!pedido || this.cancelando()) return;
    if (this.cancelacionForm.invalid) {
      this.cancelacionForm.markAllAsTouched();
      return;
    }

    this.cancelando.set(true);
    this.error.set('');
    this.servicio
      .cancelar(pedido.id, this.cancelacionForm.controls.motivo.value.trim())
      .pipe(finalize(() => this.cancelando.set(false)))
      .subscribe({
        next: (actualizado) => {
          this.sincronizarLista(actualizado);
          if (this.detalle()?.id === actualizado.id) this.detalle.set(actualizado);
          this.cerrarCancelacion();
          this.avisos.mostrar(
            'exito',
            `Pedido ${actualizado.folio} cancelado. El reembolso simulado depende de Flask.`,
          );
        },
        error: (error: unknown) => {
          this.error.set(mensajeError(error, 'No fue posible cancelar el pedido.'));
          this.avisos.mostrar('error', 'No se pudo cancelar el pedido.');
        },
      });
  }

  protected descargarComprobante(pedido: PedidoCliente): void {
    if (this.descargando()) return;
    this.descargando.set(true);
    this.servicio
      .descargarComprobante(pedido.id)
      .pipe(finalize(() => this.descargando.set(false)))
      .subscribe({
        next: (archivo) => {
          if (archivo.size === 0) {
            this.error.set('El comprobante digital no está disponible para este pedido.');
            return;
          }
          const extension = archivo.type.includes('pdf')
            ? 'pdf'
            : archivo.type.includes('json')
              ? 'json'
              : 'txt';
          const url = URL.createObjectURL(archivo);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `comprobante-${pedido.folio}.${extension}`;
          enlace.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.avisos.mostrar('informacion', 'Comprobante digital descargado.');
        },
        error: (error: unknown) => {
          this.error.set(mensajeError(error, 'No fue posible descargar el comprobante digital.'));
          this.avisos.mostrar('error', 'No se pudo descargar el comprobante.');
        },
      });
  }

  protected actualizar(): void {
    if (this.cargando() || this.detalleCargando() || this.cancelando()) return;
    this.actualizando.set(true);

    const id = this.detalle()?.id ?? this.idSolicitado();
    if (id) {
      this.servicio
        .detalle(id)
        .pipe(finalize(() => this.actualizando.set(false)))
        .subscribe({
          next: (pedido) => {
            this.detalle.set(pedido);
            this.sincronizarLista(pedido);
            this.ultimaActualizacion.set(new Date());
            this.error.set('');
          },
          error: (error: unknown) => {
            this.error.set(mensajeError(error, 'No fue posible actualizar el seguimiento.'));
          },
        });
      return;
    }

    this.servicio
      .listar(this.filtro())
      .pipe(finalize(() => this.actualizando.set(false)))
      .subscribe({
        next: (pedidos) => {
          this.pedidos.set(pedidos);
          this.ultimaActualizacion.set(new Date());
          this.error.set('');
        },
        error: (error: unknown) => {
          this.error.set(mensajeError(error, 'No fue posible actualizar tus pedidos.'));
        },
      });
  }

  protected reintentar(): void {
    const id = this.detalle()?.id ?? this.idSolicitado();
    if (id) this.cargarDetalle(id);
    else this.cargarLista();
  }

  protected estadoClase(codigo: string): string {
    if (codigo === 'ENTREGADO') return 'chip--exito';
    if (codigo === 'CANCELADO') return 'chip--error';
    if (codigo === 'EN_REPARTO') return 'chip--info';
    if (['EN_PRODUCCION', 'EN_PREPARACION', 'LISTO_ENVIO'].includes(codigo)) return 'chip--adv';
    return 'chip--neutro';
  }

  protected tieneMiniatura(pedido: PedidoCliente): boolean {
    return Boolean(pedido.miniaturaUrl) && !this.imagenesFallidas().includes(pedido.id);
  }

  protected marcarImagenFallida(id: number): void {
    this.imagenesFallidas.update((lista) =>
      lista.includes(id) ? lista : [...lista, id],
    );
  }

  protected alPulsarTecla(evento: KeyboardEvent, modal: 'guia' | 'cancelar'): void {
    if (evento.key !== 'Escape') return;
    if (modal === 'guia') this.cerrarGuia();
    else this.cerrarCancelacion();
  }

  private cargarLista(): void {
    this.cargando.set(true);
    this.error.set('');
    this.servicio
      .listar(this.filtro())
      .pipe(finalize(() => this.cargando.set(false)))
      .subscribe({
        next: (pedidos) => {
          this.pedidos.set(pedidos);
          this.ultimaActualizacion.set(new Date());
        },
        error: (error: unknown) => {
          this.error.set(mensajeError(error, 'No fue posible cargar tus pedidos.'));
        },
      });
  }

  private cargarDetalle(id: number): void {
    this.detalleCargando.set(true);
    this.error.set('');
    this.servicio
      .detalle(id)
      .pipe(finalize(() => this.detalleCargando.set(false)))
      .subscribe({
        next: (pedido) => {
          this.detalle.set(pedido);
          this.sincronizarLista(pedido);
          this.ultimaActualizacion.set(new Date());
        },
        error: (error: unknown) => {
          this.detalle.set(null);
          this.error.set(mensajeError(error, 'No fue posible cargar el seguimiento del pedido.'));
        },
      });
  }

  private sincronizarLista(pedido: PedidoCliente): void {
    this.pedidos.update((lista) =>
      lista.map((item) =>
        item.id === pedido.id
          ? {
              ...item,
              estado: pedido.estado,
              guia: pedido.guia,
              fechaEntrega: pedido.fechaEntrega,
              fechaEstimada: pedido.fechaEstimada,
              totalConIva: pedido.totalConIva,
              miniaturaUrl: item.miniaturaUrl ?? pedido.miniaturaUrl,
            }
          : item,
      ),
    );
  }

  private coincideFiltro(pedido: PedidoCliente, filtro: string): boolean {
    if (filtro === 'TODOS') return true;
    if (filtro === 'EN_PROCESO') {
      return ['RECIBIDO', 'CONFIRMADO', 'EN_PRODUCCION', 'EN_PREPARACION', 'LISTO_ENVIO'].includes(
        pedido.estado,
      );
    }
    if (filtro === 'ENVIADOS') return pedido.estado === 'EN_REPARTO';
    if (filtro === 'ENTREGADOS') return pedido.estado === 'ENTREGADO';
    return true;
  }
}
