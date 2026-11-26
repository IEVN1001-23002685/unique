import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoProduccion } from '../../componentes/chip-estado-produccion/chip-estado-produccion';
import { NavegacionProduccion } from '../../componentes/navegacion-produccion/navegacion-produccion';
import { SemaforoProduccion } from '../../componentes/semaforo-produccion/semaforo-produccion';
import {
  ETIQUETAS_ESTADO_MATERIAL,
  ETIQUETAS_ORIGEN,
  ETIQUETAS_TONO,
} from '../../modelos/produccion';
import { ProduccionServicio } from '../../servicios/produccion-servicio';

@Component({
  selector: 'app-detalle-orden',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    ModalConfirmacion,
    NavegacionProduccion,
    SemaforoProduccion,
    ChipEstadoProduccion,
  ],
  templateUrl: './detalle-orden.html',
  styleUrls: ['./detalle-orden.css', '../../produccion-compartido.css'],
})
export class DetalleOrden {
  private readonly ruta = inject(ActivatedRoute);
  private readonly avisos = inject(AvisosServicio);
  private readonly autenticacion = inject(AuthStateService);

  protected readonly servicio = inject(ProduccionServicio);
  /** La captura manual en M14 es exclusiva del Administrador (§3 y §10). */
  protected readonly esAdmin = computed(() => this.autenticacion.usuario()?.rol === 'ADMIN');
  protected readonly etiquetasOrigen = ETIQUETAS_ORIGEN;
  protected readonly etiquetasTono = ETIQUETAS_TONO;
  protected readonly etiquetasEstadoMaterial = ETIQUETAS_ESTADO_MATERIAL;

  private readonly id = toSignal(
    this.ruta.paramMap.pipe(map((params) => Number(params.get('id') ?? 0))),
    { initialValue: Number(this.ruta.snapshot.paramMap.get('id') ?? 0) },
  );

  protected readonly orden = computed(() => this.servicio.vistaPorId(this.id()));
  protected readonly pedidos = computed(() => {
    const orden = this.orden();
    return orden ? this.servicio.pedidosDeOrden(orden) : [];
  });
  protected readonly faltantes = computed(() => this.servicio.faltantesDeOrden(this.id()));

  protected readonly mostrarCompra = signal(false);
  protected readonly cancelando = signal(false);

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  protected readonly puedeReservar = computed(() => {
    const orden = this.orden();
    return (
      orden !== undefined &&
      ['PLANEADA', 'LISTA'].includes(orden.estado) &&
      orden.materialesCompletos < orden.materiales.length
    );
  });

  protected readonly puedeIniciar = computed(() => {
    const orden = this.orden();
    return (
      orden !== undefined &&
      orden.estado === 'LISTA' &&
      orden.materialesCompletos === orden.materiales.length
    );
  });

  protected reservar(): void {
    this.servicio.reservar(this.id()).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
    });
  }

  protected solicitarCompra(): void {
    this.mostrarCompra.set(true);
  }

  protected registrarSolicitud(): void {
    if (this.faltantes().length === 0) {
      this.avisos.mostrar('informacion', 'No hay materiales faltantes en esta orden.');
      return;
    }
    this.servicio.solicitarCompraAccion(this.id()).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    });
  }

  protected iniciar(): void {
    this.servicio.iniciar(this.id()).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    });
  }

  protected enviarRevision(): void {
    this.servicio.enviarRevision(this.id()).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    });
  }

  protected cancelar(): void {
    this.servicio.cancelar(this.id(), 'Cancelación solicitada desde el detalle de la orden').subscribe(
      (resultado) => {
        this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
        this.cancelando.set(false);
      },
    );
  }
}
