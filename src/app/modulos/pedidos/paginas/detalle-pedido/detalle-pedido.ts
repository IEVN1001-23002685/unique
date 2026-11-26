import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
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
  private readonly auth = inject(AuthStateService);
  private readonly avisos = inject(AvisosServicio);

  protected readonly folio = this.ruta.snapshot.paramMap.get('folio') ?? '';
  protected readonly pedido = computed(() => this.servicio.obtenerPedido(this.folio));
  protected readonly cancelando = signal(false);
  protected readonly notaIntento = signal(false);
  /** Operativo consulta el pedido; solo el Administrador ejecuta acciones (§4 M09). */
  protected readonly esAdministrador = computed(() => this.auth.puede(['ADMIN']));

  protected readonly formaNota = this.fb.nonNullable.group({
    texto: ['', [Validators.required, Validators.minLength(5)]],
  });

  constructor() {
    this.servicio.cargarDetalle(this.folio).subscribe();
  }

  protected reintentar(): void {
    this.servicio.cargarDetalle(this.folio).subscribe();
  }

  protected readonly puedeCancelar = computed(() => {
    if (!this.esAdministrador()) {
      return false;
    }
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
    if (!this.esAdministrador()) {
      this.avisos.mostrar('informacion', 'Solo el Administrador puede cambiar la prioridad.');
      return;
    }
    const prioridad = (evento.target as HTMLSelectElement).value as PrioridadPedido;
    this.servicio.cambiarPrioridad(this.folio, prioridad).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
    });
  }

  protected guardarNota(): void {
    if (!this.esAdministrador()) {
      this.avisos.mostrar('informacion', 'Solo el Administrador puede agregar notas internas.');
      return;
    }
    this.notaIntento.set(true);
    if (this.formaNota.invalid) {
      this.formaNota.markAllAsTouched();
      return;
    }

    this.servicio.agregarNota(this.folio, this.formaNota.getRawValue().texto).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
      if (resultado.ok) {
        this.formaNota.reset();
        this.notaIntento.set(false);
      }
    });
  }

  protected cancelar(motivo: string): void {
    this.cancelando.set(false);
    if (!this.esAdministrador()) {
      this.avisos.mostrar('informacion', 'Solo el Administrador puede cancelar pedidos.');
      return;
    }
    this.servicio.cancelarPedido(this.folio, motivo).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'advertencia' : 'error', resultado.mensaje);
    });
  }

  protected avisoModulo(modulo: string, nombre: string): void {
    const detalle =
      modulo === 'M08'
        ? 'Este pedido de ejemplo no tiene una venta registrada en M08.'
        : modulo === 'M18'
          ? 'Este pedido no tiene una hoja activa en M18; revisa la cola de preparación para tomarlo.'
          : `${nombre} aún no está implementado; el acceso queda preparado para la integración. No se simuló ninguna operación.`;
    this.avisos.mostrar('informacion', `${modulo} · ${detalle}`);
  }
}
