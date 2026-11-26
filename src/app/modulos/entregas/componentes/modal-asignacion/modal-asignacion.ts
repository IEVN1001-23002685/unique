import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Pedido } from '../../../pedidos/modelos/pedido';
import type { DatosAsignacion } from '../../modelos/entrega';
import { EntregasServicio } from '../../servicios/entregas-servicio';
import { fechaNoPasada } from '../../validadores/validadores-entrega';

/** Asigna repartidor y fecha a un pedido LISTO_ENVIO. Sin persistencia real. */
@Component({
  selector: 'app-modal-asignacion',
  imports: [ReactiveFormsModule],
  templateUrl: './modal-asignacion.html',
  styleUrls: ['./modal-asignacion.css', '../modales.css'],
})
export class ModalAsignacion {
  readonly pedido = input.required<Pedido>();
  readonly asignar = output<DatosAsignacion>();
  readonly cancelar = output<void>();

  private readonly fb = inject(FormBuilder);
  protected readonly servicio = inject(EntregasServicio);
  protected readonly activos = this.servicio.activos;
  protected readonly fechaMinima = this.servicio.fechaHoy();
  protected readonly intento = signal(false);

  protected readonly forma = this.fb.nonNullable.group({
    repartidorId: ['', Validators.required],
    fechaProgramada: [this.servicio.fechaHoy(), [Validators.required, fechaNoPasada]],
    notas: [''],
  });

  protected readonly repartidorInvalido = computed(() => {
    const control = this.forma.controls.repartidorId;
    return control.invalid && (control.touched || this.intento());
  });

  protected readonly fechaInvalida = computed(() => {
    const control = this.forma.controls.fechaProgramada;
    return control.invalid && (control.touched || this.intento());
  });

  protected alEnviar(): void {
    this.intento.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      return;
    }
    this.asignar.emit({
      pedidoFolio: this.pedido().folio,
      repartidorId: Number(this.forma.controls.repartidorId.value),
      fechaProgramada: this.forma.controls.fechaProgramada.value,
      notas: this.forma.controls.notas.value,
    });
  }

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.cancelar.emit();
    }
  }
}
