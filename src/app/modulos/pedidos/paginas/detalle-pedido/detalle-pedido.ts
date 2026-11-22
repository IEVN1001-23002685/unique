import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoPedido } from '../../componentes/chip-estado-pedido/chip-estado-pedido';
import { ModalCancelarPedido } from '../../componentes/modal-cancelar-pedido/modal-cancelar-pedido';
import { NavegacionPedidos } from '../../componentes/navegacion-pedidos/navegacion-pedidos';
import { SemaforoPedido } from '../../componentes/semaforo-pedido/semaforo-pedido';
import { PedidosServicio } from '../../servicios/pedidos-servicio';
import type { Pedido, PrioridadPedido } from '../../modelos/pedido';

@Component({
  selector: 'app-detalle-pedido',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    ChipEstadoPedido,
    ModalCancelarPedido,
    NavegacionPedidos,
    SemaforoPedido,
  ],
  templateUrl: './detalle-pedido.html',
  styleUrl: './detalle-pedido.css',
})
export class DetallePedido {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly servicio = inject(PedidosServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly folio = this.ruta.snapshot.paramMap.get('folio') ?? '';
  protected readonly pedido = computed(() => this.servicio.obtenerPedido(this.folio));
  protected readonly cancelando = signal(false);
  protected readonly notaIntento = signal(false);

  protected readonly formaNota = this.fb.nonNullable.group({
    texto: ['', [Validators.required, Validators.minLength(5)]],
  });

  constructor() {
    this.servicio.sincronizarDesdeVentas();
  }

  protected readonly puedeCancelar = computed(() => {
    const estado = this.pedido()?.estado;
    return (
      estado === 'RECIBIDO' ||
      estado === 'CONFIRMADO' ||
      estado === 'EN_PRODUCCION' ||
      estado === 'EN_PREPARACION' ||
      estado === 'LISTO_ENVIO'
    );
  });

  protected readonly notaInvalida = computed(() => {
    const control = this.formaNota.controls.texto;
    return control.invalid && (control.touched || this.notaIntento());
  });

  protected tiempo(pedido: Pedido): string {
    return this.servicio.formatoTiempo(this.servicio.horasEnEstado(pedido));
  }

  protected cambiarPrioridad(evento: Event): void {
    const prioridad = (evento.target as HTMLSelectElement).value as PrioridadPedido;
    const ok = this.servicio.cambiarPrioridad(this.folio, prioridad);
    this.avisos.mostrar(
      ok ? 'exito' : 'advertencia',
      ok
        ? `Prioridad actualizada a ${prioridad}. El cambio quedó solo en memoria.`
        : 'No fue posible cambiar la prioridad de este pedido.',
    );
  }

  protected guardarNota(): void {
    this.notaIntento.set(true);
    if (this.formaNota.invalid) {
      this.formaNota.markAllAsTouched();
      return;
    }

    const ok = this.servicio.agregarNota(this.folio, this.formaNota.getRawValue().texto);
    this.avisos.mostrar(
      ok ? 'exito' : 'error',
      ok
        ? 'Nota interna agregada al historial de demostración.'
        : 'No fue posible agregar la nota. Revisa el texto capturado.',
    );
    if (ok) {
      this.formaNota.reset();
      this.notaIntento.set(false);
    }
  }

  protected cancelar(motivo: string): void {
    const ok = this.servicio.cancelarPedido(this.folio, motivo);
    this.cancelando.set(false);
    this.avisos.mostrar(
      ok ? 'advertencia' : 'error',
      ok
        ? 'Pedido cancelado en memoria. Reembolsos (M08), reservas (M12) y órdenes (M16) requieren Flask.'
        : 'Este pedido ya no puede cancelarse desde la interfaz.',
    );
  }

  protected avisoModulo(modulo: string, nombre: string): void {
    const detalle =
      modulo === 'M08'
        ? 'Este pedido de ejemplo no tiene una venta registrada en M08.'
        : `${nombre} aún no está implementado; el acceso queda preparado para la integración. No se simuló ninguna operación.`;
    this.avisos.mostrar('informacion', `${modulo} · ${detalle}`);
  }
}
