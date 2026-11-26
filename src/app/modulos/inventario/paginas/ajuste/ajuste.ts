import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { decimalNoNegativo } from '../../../../compartido/validadores/validadores-negocio';
import { mensajeError } from '../../../../core/api/errores';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionInventario } from '../../componentes/navegacion-inventario/navegacion-inventario';
import { MOTIVOS_AJUSTE, type ResultadoAjuste } from '../../modelos/inventario';
import { InventarioServicio, redondear4 } from '../../servicios/inventario-servicio';

@Component({
  selector: 'app-ajuste',
  imports: [DecimalPipe, ReactiveFormsModule, RouterLink, NavegacionInventario, ModalConfirmacion],
  templateUrl: './ajuste.html',
  styleUrls: ['./ajuste.css', '../../inventario-compartido.css'],
})
export class Ajuste {
  private readonly fb = inject(FormBuilder);
  private readonly avisos = inject(AvisosServicio);
  protected readonly servicio = inject(InventarioServicio);

  protected readonly motivos = MOTIVOS_AJUSTE;
  protected readonly intentoEnvio = signal(false);
  protected readonly confirmarMerma = signal(false);
  protected readonly resultado = signal<ResultadoAjuste | null>(null);

  protected readonly vistas = computed(() =>
    this.servicio.vistas().filter((vista) => vista.material.activo),
  );

  protected readonly formulario = this.fb.nonNullable.group({
    existenciaId: [0, [Validators.required, Validators.min(1)]],
    cantidadContada: [0, [Validators.required, decimalNoNegativo]],
    motivo: ['', [Validators.required]],
    enviarAMerma: [false],
  });

  protected readonly seleccionada = computed(() => {
    const id = this.formulario.controls.existenciaId.value;
    return this.vistas().find((vista) => vista.id === id);
  });

  protected readonly diferencia = computed(() => {
    const vista = this.seleccionada();
    if (!vista) {
      return 0;
    }
    return redondear4(this.formulario.controls.cantidadContada.value - vista.fisico);
  });

  protected esInvalido(campo: 'existenciaId' | 'cantidadContada' | 'motivo'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.intentoEnvio());
  }

  protected redondear(valor: number): number {
    return redondear4(Math.max(0, valor));
  }

  protected guardar(): void {
    this.intentoEnvio.set(true);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.avisos.mostrar('error', 'Indica material, cantidad contada y motivo del ajuste.');
      return;
    }

    const vista = this.seleccionada();
    const diferencia = this.diferencia();
    if (!vista || diferencia === 0) {
      this.avisos.mostrar('error', 'La cantidad contada debe diferir de la cantidad en sistema.');
      return;
    }
    if (this.formulario.controls.enviarAMerma.value && diferencia > 0) {
      this.avisos.mostrar('error', 'Solo se puede mandar a merma una diferencia a la baja.');
      return;
    }
    if (this.formulario.controls.enviarAMerma.value) {
      this.confirmarMerma.set(true);
      return;
    }
    this.registrar();
  }

  protected confirmarEnvioMerma(): void {
    this.confirmarMerma.set(false);
    this.registrar();
  }

  private registrar(): void {
    const valor = this.formulario.getRawValue();
    this.servicio
      .registrarAjuste({
        existenciaId: valor.existenciaId,
        cantidadContada: redondear4(valor.cantidadContada),
        motivo: valor.motivo,
        enviarAMerma: valor.enviarAMerma,
      })
      .subscribe({
        next: (resultado) => {
          if (!resultado) {
            this.avisos.mostrar('error', 'No fue posible registrar el ajuste con esos datos.');
            return;
          }
          this.resultado.set(resultado);
          const detalle = resultado.movimiento
            ? 'El movimiento ya aparece en el kardex.'
            : 'Flask aceptó el ajuste; el movimiento debe confirmarse en el kardex.';
          const merma = resultado.merma
            ? ' Solicitud de merma enviada; M17 debe confirmarla.'
            : '';
          this.avisos.mostrar('exito', `Ajuste registrado en Flask. ${detalle}${merma}`);
        },
        error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
      });
  }

  protected nuevoAjuste(): void {
    this.resultado.set(null);
    this.intentoEnvio.set(false);
    this.formulario.reset({ existenciaId: 0, cantidadContada: 0, motivo: '', enviarAMerma: false });
  }

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }
}
