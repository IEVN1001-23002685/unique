import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { mensajeError } from '../../../../core/api/errores';
import { formatearFechaHora } from '../../../../core/api/formato';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import {
  HORAS_ALERTA,
  claseEstado,
  etiquetaEstado,
  etiquetaMotivo,
  horasSinAtender,
  type SolicitudCambioDevolucion,
} from '../../modelos/cambio-devolucion';
import { DevolucionesServicio } from '../../servicios/devoluciones-servicio';

const FILTROS = [
  { valor: 'PENDIENTES', etiqueta: 'Pendientes de atención' },
  { valor: 'SOLICITADA', etiqueta: 'Solicitadas' },
  { valor: 'APROBADA', etiqueta: 'Aprobadas' },
  { valor: 'RECIBIDA', etiqueta: 'Recibidas' },
  { valor: 'RESUELTA', etiqueta: 'Resueltas' },
  { valor: 'TODOS', etiqueta: 'Todas' },
] as const;

/** Bandeja administrativa y operativa; evidencia, aprobación, rechazo y recepción. */
@Component({
  selector: 'app-cd-bandeja',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './bandeja.html',
  styleUrls: ['./bandeja.css', '../../cambios-devoluciones-compartido.css'],
})
export class Bandeja {
  readonly solicitudes = input<SolicitudCambioDevolucion[]>([]);
  readonly cargando = input(false);
  readonly error = input('');
  readonly puedeAprobar = input(false);
  readonly puedeOperar = input(false);

  readonly recargar = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(DevolucionesServicio);
  private readonly avisos = inject(AvisosServicio);

  readonly filtros = FILTROS;
  readonly filtro = signal('PENDIENTES');
  readonly casoARechazar = signal<SolicitudCambioDevolucion | null>(null);
  readonly casoConEvidencias = signal<SolicitudCambioDevolucion | null>(null);
  readonly imagenesFallidas = signal<number[]>([]);
  readonly procesando = signal<number | null>(null);
  readonly errorLocal = signal('');

  readonly rechazoForm = this.fb.nonNullable.group({
    motivo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
  });

  readonly etiquetaEstado = etiquetaEstado;
  readonly etiquetaMotivo = etiquetaMotivo;
  readonly claseEstado = claseEstado;
  readonly formatearFechaHora = formatearFechaHora;
  readonly horasSinAtender = horasSinAtender;
  readonly umbralAlerta = HORAS_ALERTA;

  readonly filtradas = computed(() => {
    const valor = this.filtro();
    if (valor === 'TODOS') return this.solicitudes();
    if (valor === 'PENDIENTES') {
      return this.solicitudes().filter((caso) =>
        ['SOLICITADA', 'APROBADA', 'RECIBIDA'].includes(caso.estado),
      );
    }
    return this.solicitudes().filter((caso) => caso.estado === valor);
  });

  readonly alertas = computed(() =>
    this.solicitudes().filter(
      (caso) =>
        ['SOLICITADA', 'RECIBIDA'].includes(caso.estado) &&
        horasSinAtender(caso) > HORAS_ALERTA,
    ),
  );

  protected cambiarFiltro(valor: string): void {
    this.filtro.set(valor);
  }

  protected enAlerta(caso: SolicitudCambioDevolucion): boolean {
    return (
      ['SOLICITADA', 'RECIBIDA'].includes(caso.estado) &&
      horasSinAtender(caso) > HORAS_ALERTA
    );
  }

  protected listoParaResolver(caso: SolicitudCambioDevolucion): boolean {
    return (
      caso.estado === 'RECIBIDA' &&
      caso.lineas.length > 0 &&
      caso.lineas.every((linea) => !!linea.dictamen && linea.dictamen !== 'PENDIENTE')
    );
  }

  protected aprobar(caso: SolicitudCambioDevolucion): void {
    if (!this.puedeAprobar()) return;
    this.ejecutar(caso, () => this.servicio.aprobar(caso.id), 'aprobada');
  }

  protected abrirRechazo(caso: SolicitudCambioDevolucion): void {
    if (!this.puedeAprobar()) return;
    this.rechazoForm.reset();
    this.errorLocal.set('');
    this.casoARechazar.set(caso);
  }

  protected cerrarRechazo(): void {
    this.casoARechazar.set(null);
    this.rechazoForm.reset();
  }

  protected confirmarRechazo(): void {
    const caso = this.casoARechazar();
    if (!caso || this.procesando() !== null) return;
    if (this.rechazoForm.invalid) {
      this.rechazoForm.markAllAsTouched();
      return;
    }
    const motivo = this.rechazoForm.controls.motivo.value.trim();
    this.ejecutar(caso, () => this.servicio.rechazar(caso.id, motivo), 'rechazada');
    this.cerrarRechazo();
  }

  protected recibir(caso: SolicitudCambioDevolucion): void {
    if (!this.puedeOperar()) return;
    this.ejecutar(caso, () => this.servicio.recibir(caso.id), 'recibida; pendiente de dictamen');
  }

  protected verEvidencias(caso: SolicitudCambioDevolucion): void {
    this.imagenesFallidas.set([]);
    this.casoConEvidencias.set(caso);
  }

  protected cerrarEvidencias(): void {
    this.casoConEvidencias.set(null);
  }

  protected marcarImagenFallida(indice: number): void {
    this.imagenesFallidas.update((lista) =>
      lista.includes(indice) ? lista : [...lista, indice],
    );
  }

  protected alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key !== 'Escape') return;
    if (this.casoARechazar()) this.cerrarRechazo();
    else this.cerrarEvidencias();
  }

  private ejecutar(
    caso: SolicitudCambioDevolucion,
    operacion: () => Observable<SolicitudCambioDevolucion>,
    resultado: string,
  ): void {
    if (this.procesando() !== null) return;
    this.procesando.set(caso.id);
    this.errorLocal.set('');
    operacion()
      .pipe(finalize(() => this.procesando.set(null)))
      .subscribe({
        next: () => {
          this.avisos.mostrar('exito', `${caso.folioCaso} ${resultado}.`);
          this.recargar.emit();
        },
        error: (error: unknown) => {
          const mensaje = mensajeError(error, 'No fue posible completar la acción.');
          this.errorLocal.set(mensaje);
          this.avisos.mostrar('error', mensaje);
        },
      });
  }
}
