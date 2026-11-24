import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
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

  protected readonly servicio = inject(ProduccionServicio);
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
  protected readonly faltantes = computed(() => this.servicio.solicitarCompra(this.id()));

  protected readonly mostrarCompra = signal(false);
  protected readonly cancelando = signal(false);

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
    const resultado = this.servicio.reservar(this.id());
    this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
  }

  protected solicitarCompra(): void {
    this.mostrarCompra.set(true);
  }

  protected registrarSolicitud(): void {
    const faltantes = this.faltantes();
    if (faltantes.length === 0) {
      this.avisos.mostrar('informacion', 'No hay materiales faltantes en esta orden.');
      return;
    }
    this.avisos.mostrar(
      'informacion',
      `Solicitud preparada para ${faltantes.length} material(es). Flask debe crear la requisición REQ en M14, verificar duplicados y reevaluar el semáforo; no se guardó nada.`,
    );
  }

  protected iniciar(): void {
    const resultado = this.servicio.iniciar(this.id());
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
  }

  protected enviarRevision(): void {
    const resultado = this.servicio.enviarRevision(this.id());
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
  }

  protected cancelar(): void {
    const resultado = this.servicio.cancelar(this.id());
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    this.cancelando.set(false);
  }
}
