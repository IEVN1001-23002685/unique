import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { UrlImagenPipe } from '../../../../compartido/pipes/url-imagen.pipe';
import { mensajeError } from '../../../../core/api/errores';
import { formatearFechaHora } from '../../../../core/api/formato';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import {
  CAUSAS_MERMA,
  ETAPAS_MERMA,
  etiquetaDictamen,
  etiquetaEstado,
  etiquetaMotivo,
  claseEstado,
  type DictamenLinea,
  type SolicitudCambioDevolucion,
} from '../../modelos/cambio-devolucion';
import {
  DevolucionesServicio,
  type DictamenLineaSolicitud,
} from '../../servicios/devoluciones-servicio';

interface LineaInspeccionForm {
  devolucionLineaId: FormControl<number>;
  dictamen: FormControl<DictamenLinea>;
  causa: FormControl<string>;
  etapa: FormControl<string>;
}

/** Recepción e inspección (Operativo): registrar llegada y dictaminar cada prenda (§7 M07). */
@Component({
  selector: 'app-cd-recepcion',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, UrlImagenPipe],
  templateUrl: './recepcion.html',
  styleUrls: ['./recepcion.css', '../../cambios-devoluciones-compartido.css'],
})
export class Recepcion {
  readonly caso = input<SolicitudCambioDevolucion | null>(null);
  readonly puedeOperar = input(false);
  readonly actualizado = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(DevolucionesServicio);
  private readonly avisos = inject(AvisosServicio);

  readonly causas = CAUSAS_MERMA;
  readonly etapas = ETAPAS_MERMA;
  readonly etiquetaDictamen = etiquetaDictamen;
  readonly etiquetaEstado = etiquetaEstado;
  readonly etiquetaMotivo = etiquetaMotivo;
  readonly claseEstado = claseEstado;
  readonly formatearFechaHora = formatearFechaHora;

  readonly form = this.fb.nonNullable.group({
    observaciones: ['', [Validators.maxLength(300)]],
    lineas: this.fb.array<FormGroup<LineaInspeccionForm>>([]),
  });

  readonly procesando = signal(false);
  readonly errorLocal = signal('');
  readonly readonlyMode = computed(() => {
    const caso = this.caso();
    return !caso || caso.estado === 'RESUELTA' || caso.estado === 'RECHAZADA';
  });

  private claveCargada = '';

  constructor() {
    effect(() => {
      const caso = this.caso();
      const clave = caso ? `${caso.id}:${caso.estado}` : '';
      if (clave === this.claveCargada) return;
      this.claveCargada = clave;
      this.preparar(caso);
    });
  }

  protected get lineasForm(): FormGroup<LineaInspeccionForm>[] {
    return this.form.controls.lineas.controls;
  }

  protected requiereCausaEtapa(linea: FormGroup<LineaInspeccionForm>): boolean {
    return linea.controls.dictamen.value === 'MERMA';
  }

  protected lineaInvalida(linea: FormGroup<LineaInspeccionForm>): boolean {
    return linea.invalid && (linea.dirty || linea.touched);
  }

  protected registrarRecepcion(): void {
    const caso = this.caso();
    if (!caso || !this.puedeOperar() || caso.estado !== 'APROBADA' || this.procesando()) return;
    this.procesando.set(true);
    this.errorLocal.set('');
    this.servicio
      .recibir(caso.id)
      .pipe(finalize(() => this.procesando.set(false)))
      .subscribe({
        next: () => {
          this.avisos.mostrar('exito', `${caso.folioCaso} recibido. Ahora dictamina cada prenda.`);
          this.actualizado.emit();
        },
        error: (error: unknown) => {
          this.errorLocal.set(mensajeError(error, 'No fue posible registrar la recepción.'));
        },
      });
  }

  protected guardarDictamen(): void {
    const caso = this.caso();
    if (!caso || !this.puedeOperar() || caso.estado !== 'RECIBIDA' || this.procesando()) return;
    this.errorLocal.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorLocal.set('Completa el dictamen de cada prenda. MERMA requiere causa y etapa.');
      return;
    }

    const lineas: Array<DictamenLineaSolicitud | null> = this.lineasForm.map((grupo) => {
      const valor = grupo.getRawValue();
      if (valor.dictamen === 'PENDIENTE') return null;
      if (valor.dictamen === 'MERMA') {
        return {
          devolucion_linea_id: valor.devolucionLineaId,
          dictamen: 'MERMA',
          causa_nombre: valor.causa,
          descripcion: valor.etapa,
        };
      }
      return {
        devolucion_linea_id: valor.devolucionLineaId,
        dictamen: 'REINGRESO',
      };
    });
    const dictamenes = lineas.filter(
      (linea): linea is DictamenLineaSolicitud => linea !== null,
    );

    if (dictamenes.length === 0 || dictamenes.length !== this.lineasForm.length) {
      this.errorLocal.set('Dictamina todas las prendas antes de continuar.');
      return;
    }

    this.procesando.set(true);
    this.servicio
      .dictaminar(caso.id, dictamenes, this.form.controls.observaciones.value.trim())
      .pipe(finalize(() => this.procesando.set(false)))
      .subscribe({
        next: () => {
          this.avisos.mostrar('exito', `Dictamen de ${caso.folioCaso} registrado.`);
          this.actualizado.emit();
        },
        error: (error: unknown) => {
          this.errorLocal.set(mensajeError(error, 'No fue posible registrar el dictamen.'));
        },
      });
  }

  private preparar(caso: SolicitudCambioDevolucion | null): void {
    this.form.controls.lineas.clear();
    this.form.controls.observaciones.setValue('');
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.errorLocal.set('');
    if (!caso) return;

    caso.lineas.forEach((linea) => {
      const dictamen: DictamenLinea =
        linea.dictamen === 'REINGRESO' || linea.dictamen === 'MERMA'
          ? linea.dictamen
          : 'PENDIENTE';
      const grupo = this.fb.group<LineaInspeccionForm>(
        {
          devolucionLineaId: this.fb.nonNullable.control(linea.id),
          dictamen: this.fb.nonNullable.control<DictamenLinea>(dictamen),
          causa: this.fb.nonNullable.control(''),
          etapa: this.fb.nonNullable.control(''),
        },
        {
          validators: (control) => {
            if (control.get('dictamen')?.value !== 'MERMA') return null;
            const causa = String(control.get('causa')?.value ?? '').trim();
            const etapa = String(control.get('etapa')?.value ?? '').trim();
            return causa && etapa ? null : { causaEtapaRequeridas: true };
          },
        },
      );
      this.form.controls.lineas.push(grupo);
    });
  }
}
