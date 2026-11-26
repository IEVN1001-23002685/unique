import { Component, computed, inject, input, output, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { DatosRepartidor, Repartidor } from '../../modelos/entrega';
import { telefonoDiezDigitos } from '../../validadores/validadores-entrega';

/** Alta y edición del catálogo de repartidores (Administrador en el documento). */
@Component({
  selector: 'app-modal-repartidor',
  imports: [ReactiveFormsModule],
  templateUrl: './modal-repartidor.html',
  styleUrls: ['./modal-repartidor.css', '../modales.css'],
})
export class ModalRepartidor implements OnInit {
  readonly repartidor = input<Repartidor | null>(null);
  readonly guardar = output<DatosRepartidor>();
  readonly cancelar = output<void>();

  private readonly fb = inject(FormBuilder);
  protected readonly intento = signal(false);

  protected readonly forma = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    telefono: ['', [Validators.required, telefonoDiezDigitos]],
    vehiculo: [''],
  });

  protected readonly esEdicion = computed(() => this.repartidor() !== null);

  protected readonly nombreInvalido = computed(() => {
    const control = this.forma.controls.nombre;
    return control.invalid && (control.touched || this.intento());
  });

  protected readonly telefonoInvalido = computed(() => {
    const control = this.forma.controls.telefono;
    return control.invalid && (control.touched || this.intento());
  });

  /** Inicializa el formulario cuando el modal se crea para editar. */
  ngOnInit(): void {
    const actual = this.repartidor();
    if (actual) {
      this.forma.setValue({
        nombre: actual.nombre,
        telefono: actual.telefono,
        vehiculo: actual.vehiculo ?? '',
      });
    }
  }

  protected alEnviar(): void {
    this.intento.set(true);
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      return;
    }
    this.guardar.emit({
      nombre: this.forma.controls.nombre.value,
      telefono: this.forma.controls.telefono.value,
      vehiculo: this.forma.controls.vehiculo.value,
    });
  }

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      this.cancelar.emit();
    }
  }
}
