import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionRecetas } from '../../componentes/navegacion-recetas/navegacion-recetas';
import type { DatosDiseno, DisenoBordado, HiloDiseno } from '../../modelos/receta';
import { RecetasServicio } from '../../servicios/recetas-servicio';
import { redondear } from '../../servicios/calculos-receta';

@Component({
  selector: 'app-disenos-bordado',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, ModalConfirmacion, NavegacionRecetas],
  templateUrl: './disenos-bordado.html',
  styleUrl: './disenos-bordado.css',
})
export class DisenosBordado {
  private readonly fb = inject(FormBuilder);
  protected readonly servicio = inject(RecetasServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly seleccionado = signal<number | null>(null);
  protected readonly creando = signal(false);
  protected readonly intento = signal(false);
  protected readonly eliminando = signal<DisenoBordado | null>(null);

  protected readonly diseno = computed(() => {
    const id = this.seleccionado();
    return id === null ? undefined : this.servicio.disenoDe(id);
  });

  protected readonly hilosDiseno = this.servicio.etiquetasHilo();

  protected readonly formas = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    anchoCm: [0, [Validators.required, Validators.min(0.1)]],
    altoCm: [0, [Validators.required, Validators.min(0.1)]],
    notas: [''],
    activo: [true],
    hilos: this.fb.nonNullable.array([]),
  });

  private readonly valores = signal(this.formas.getRawValue());

  protected readonly totalMetros = computed(() =>
    redondear(
      this.valores()
        .hilos.reduce((suma, hilo) => suma + Number(hilo.metrosPorAplicacion), 0),
      3,
    ),
  );

  protected readonly costoHilos = computed(() =>
    redondear(
      this.valores().hilos.reduce((suma, hilo) => {
        const material = this.servicio.materialDe(hilo.materialCodigo);
        return suma + Number(hilo.metrosPorAplicacion) * (material?.costoBase ?? 0);
      }, 0),
    ),
  );

  protected readonly usos = computed(() => {
    const id = this.seleccionado();
    if (id === null) {
      return [];
    }
    return this.servicio.recetas().filter((receta) =>
      receta.bordados.some((bordado) => bordado.disenoId === id),
    );
  });

  constructor() {
    this.formas.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.valores.set(this.formas.getRawValue());
    });
    this.seleccionar(this.servicio.disenos()[0]?.id ?? null);
  }

  protected seleccionar(id: number | null): void {
    this.seleccionado.set(id);
    this.creando.set(false);
    this.intento.set(false);
    const diseno = id === null ? undefined : this.servicio.disenoDe(id);
    this.formas.controls.hilos.clear();
    this.formas.reset({
      nombre: diseno?.nombre ?? '',
      anchoCm: diseno?.anchoCm ?? 1,
      altoCm: diseno?.altoCm ?? 1,
      notas: diseno?.notas ?? '',
      activo: diseno?.activo ?? true,
      hilos: [],
    });
    for (const hilo of diseno?.hilos ?? []) {
      this.formas.controls.hilos.push(this.hiloForm(hilo));
    }
  }

  protected nuevo(): void {
    this.seleccionar(null);
    this.creando.set(true);
  }

  private hiloForm(hilo?: HiloDiseno) {
    return this.fb.nonNullable.group({
      materialCodigo: [hilo?.materialCodigo ?? this.hilosDiseno[0]?.codigo ?? '', Validators.required],
      metrosPorAplicacion: [
        hilo?.metrosPorAplicacion ?? 0,
        [Validators.required, Validators.min(0)],
      ],
    });
  }

  protected agregarHilo(): void {
    this.formas.controls.hilos.push(this.hiloForm());
  }

  protected quitarHilo(indice: number): void {
    this.formas.controls.hilos.removeAt(indice);
  }

  protected invalido(campo: 'nombre' | 'anchoCm' | 'altoCm'): boolean {
    const control = this.formas.controls[campo];
    return control.invalid && (control.touched || this.intento());
  }

  protected guardar(): void {
    this.intento.set(true);
    if (this.formas.invalid) {
      this.formas.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa el nombre, las dimensiones y los metros de hilo capturados.');
      return;
    }
    const raw = this.formas.getRawValue();
    const datos: DatosDiseno = {
      nombre: raw.nombre.trim(),
      anchoCm: Number(raw.anchoCm),
      altoCm: Number(raw.altoCm),
      notas: raw.notas.trim(),
      activo: raw.activo,
      hilos: raw.hilos.map((hilo) => ({
        materialCodigo: hilo.materialCodigo,
        metrosPorAplicacion: Number(hilo.metrosPorAplicacion),
      })),
    };
    const id = this.seleccionado();
    const resultado = this.servicio.guardarDiseno(datos, id ?? undefined);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok && resultado.disenoId !== undefined) {
      this.seleccionar(resultado.disenoId);
    }
  }

  protected digitalizar(): void {
    const id = this.seleccionado();
    if (id === null) {
      return;
    }
    const resultado = this.servicio.digitalizarDiseno(id);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje);
    if (resultado.ok) {
      this.seleccionar(id);
    }
  }

  protected pedirEliminacion(diseno: DisenoBordado): void {
    this.eliminando.set(diseno);
  }

  protected confirmarEliminacion(): void {
    const diseno = this.eliminando();
    if (!diseno) {
      return;
    }
    const resultado = this.servicio.eliminarDiseno(diseno.id);
    this.avisos.mostrar(resultado.ok ? 'advertencia' : 'error', resultado.mensaje);
    this.eliminando.set(null);
    if (resultado.ok) {
      this.seleccionar(this.servicio.disenos()[0]?.id ?? null);
    }
  }
}
