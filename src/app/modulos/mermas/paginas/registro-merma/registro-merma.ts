import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { PerfilSesionServicio } from '../../../../nucleo/servicios/perfil-sesion-servicio';
import { decimalPositivo } from '../../../../compartido/validadores/validadores-negocio';
import { NavegacionMermas } from '../../componentes/navegacion-mermas/navegacion-mermas';
import { MermasServicio } from '../../servicios/mermas-servicio';
import {
  ETAPAS_MERMA,
  ETIQUETAS_ETAPA,
  type DatosNuevaMerma,
  type EtapaMerma,
  type OrigenMerma,
} from '../../modelos/merma';

interface FormularioMerma {
  origen: FormControl<OrigenMerma>;
  materialId: FormControl<number | null>;
  color: FormControl<string>;
  loteId: FormControl<number | null>;
  sku: FormControl<string>;
  cantidad: FormControl<number | null>;
  etapa: FormControl<EtapaMerma | ''>;
  causaId: FormControl<number | null>;
  ordenFolio: FormControl<string>;
  descripcion: FormControl<string>;
  evidenciaNombre: FormControl<string | null>;
}

const TIPOS_EVIDENCIA = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO_EVIDENCIA = 2 * 1024 * 1024;

/** Las prendas se registran en unidades enteras (§5 y §6 del documento). */
const cantidadSegunOrigen: ValidatorFn = (control) => {
  const origen = control.parent?.get('origen')?.value as OrigenMerma | undefined;
  const valor = control.value;
  if (origen === 'PRODUCTO' && typeof valor === 'number' && !Number.isInteger(valor)) {
    return { enteroRequerido: true };
  }
  return null;
};

/** Registro manual de mermas (M17) contra POST /mermas. */
@Component({
  selector: 'app-registro-merma',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, NavegacionMermas],
  templateUrl: './registro-merma.html',
  styleUrls: ['./registro-merma.css', '../../mermas-compartido.css'],
})
export class RegistroMerma {
  protected readonly servicio = inject(MermasServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly auth = inject(AuthStateService);
  private readonly perfilSesion = inject(PerfilSesionServicio);

  protected readonly etapas = ETAPAS_MERMA;
  protected readonly etiquetasEtapa = ETIQUETAS_ETAPA;
  protected readonly errorEvidencia = signal<string | null>(null);
  protected readonly ultimoFolio = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly forma = new FormGroup<FormularioMerma>({
    origen: new FormControl<OrigenMerma>('MATERIAL', { nonNullable: true }),
    materialId: new FormControl<number | null>(null, [Validators.required]),
    color: new FormControl('', { nonNullable: true }),
    loteId: new FormControl<number | null>(null, [Validators.required]),
    sku: new FormControl('', { nonNullable: true }),
    cantidad: new FormControl<number | null>(null, [
      Validators.required,
      decimalPositivo,
      cantidadSegunOrigen,
    ]),
    etapa: new FormControl<EtapaMerma | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    causaId: new FormControl<number | null>(null, [Validators.required]),
    ordenFolio: new FormControl('', { nonNullable: true }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10)],
    }),
    evidenciaNombre: new FormControl<string | null>(null),
  });

  constructor() {
    // El lote depende del material; se habilita solo cuando hay uno seleccionado.
    this.forma.controls.loteId.disable({ emitEvent: false });
  }

  private readonly origen = toSignal(this.forma.controls.origen.valueChanges, {
    initialValue: this.forma.controls.origen.value,
  });
  private readonly materialId = toSignal(this.forma.controls.materialId.valueChanges, {
    initialValue: this.forma.controls.materialId.value,
  });
  private readonly color = toSignal(this.forma.controls.color.valueChanges, {
    initialValue: this.forma.controls.color.value,
  });
  private readonly loteId = toSignal(this.forma.controls.loteId.valueChanges, {
    initialValue: this.forma.controls.loteId.value,
  });
  private readonly sku = toSignal(this.forma.controls.sku.valueChanges, {
    initialValue: this.forma.controls.sku.value,
  });
  private readonly cantidad = toSignal(this.forma.controls.cantidad.valueChanges, {
    initialValue: this.forma.controls.cantidad.value,
  });

  protected readonly materiales = computed(() => this.servicio.opcionesMateriales());
  protected readonly lotes = computed(() => {
    const id = this.materialId();
    return id === null ? [] : this.servicio.lotesDe(id, this.color());
  });
  protected readonly variantes = computed(() => this.servicio.opcionesVariantes());
  protected readonly ordenes = computed(() => this.servicio.ordenesDisponibles());
  protected readonly causas = computed(() => this.servicio.causasPara(this.origen()));
  protected readonly costo = computed(() =>
    this.servicio.costoEstimado(
      this.origen(),
      this.materialId(),
      this.loteId(),
      this.sku(),
      this.cantidad(),
    ),
  );
  protected readonly esAdministrador = computed(() =>
    this.auth.puede(['ADMIN']),
  );

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  protected alCambiarOrigen(evento: Event): void {
    const origen = (evento.target as HTMLSelectElement).value as OrigenMerma;
    const materialId = this.forma.controls.materialId;
    const loteId = this.forma.controls.loteId;
    const sku = this.forma.controls.sku;

    materialId.reset(null);
    loteId.reset(null);
    loteId.disable({ emitEvent: false });
    sku.reset('');
    this.forma.controls.color.reset('');

    if (origen === 'MATERIAL') {
      materialId.setValidators([Validators.required]);
      loteId.setValidators([Validators.required]);
      sku.clearValidators();
    } else {
      sku.setValidators([Validators.required]);
      materialId.clearValidators();
      loteId.clearValidators();
    }
    materialId.updateValueAndValidity({ emitEvent: false });
    loteId.updateValueAndValidity({ emitEvent: false });
    sku.updateValueAndValidity({ emitEvent: false });
    this.forma.controls.cantidad.updateValueAndValidity({ emitEvent: false });
    this.ultimoFolio.set(null);
  }

  protected alCambiarMaterial(evento: Event): void {
    const id = Number((evento.target as HTMLSelectElement).value);
    const valido = Number.isFinite(id) && id > 0;
    this.forma.controls.materialId.setValue(valido ? id : null);
    if (valido) {
      this.forma.controls.loteId.enable({ emitEvent: false });
    } else {
      this.forma.controls.loteId.disable({ emitEvent: false });
    }
    this.forma.controls.loteId.reset(null);
  }

  protected limpiar(): void {
    this.forma.reset();
    this.forma.controls.origen.setValue('MATERIAL');
    this.forma.controls.materialId.setValidators([Validators.required]);
    this.forma.controls.loteId.setValidators([Validators.required]);
    this.forma.controls.sku.clearValidators();
    this.forma.controls.materialId.updateValueAndValidity({ emitEvent: false });
    this.forma.controls.loteId.updateValueAndValidity({ emitEvent: false });
    this.forma.controls.sku.updateValueAndValidity({ emitEvent: false });
    this.forma.controls.cantidad.updateValueAndValidity({ emitEvent: false });
    this.forma.controls.loteId.disable({ emitEvent: false });
    this.errorEvidencia.set(null);
    this.ultimoFolio.set(null);
    const entrada = document.getElementById('evidencia-merma') as HTMLInputElement | null;
    if (entrada) {
      entrada.value = '';
    }
  }

  protected alCambiarCausa(evento: Event): void {
    const id = Number((evento.target as HTMLSelectElement).value);
    const causa = this.servicio.causas().find((item) => item.id === id);
    const etapa = this.forma.controls.etapa;
    if (causa?.etapaSugerida && !etapa.touched) {
      etapa.setValue(causa.etapaSugerida);
    }
  }

  protected alSeleccionarArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    if (!archivo) {
      this.quitarArchivo();
      return;
    }
    if (!TIPOS_EVIDENCIA.includes(archivo.type)) {
      this.errorEvidencia.set('Usa un archivo JPG, PNG o WebP.');
      this.forma.controls.evidenciaNombre.setValue(null);
      entrada.value = '';
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_EVIDENCIA) {
      this.errorEvidencia.set('La evidencia no debe superar 2 MB.');
      this.forma.controls.evidenciaNombre.setValue(null);
      entrada.value = '';
      return;
    }
    this.errorEvidencia.set(null);
    // Solo se conserva el nombre: no se sube ni se guarda el archivo (frontend).
    this.forma.controls.evidenciaNombre.setValue(archivo.name);
  }

  protected quitarArchivo(): void {
    this.forma.controls.evidenciaNombre.setValue(null);
    this.errorEvidencia.set(null);
    const entrada = document.getElementById('evidencia-merma') as HTMLInputElement | null;
    if (entrada) {
      entrada.value = '';
    }
  }

  protected guardar(): void {
    if (this.enviando()) {
      return;
    }
    if (this.servicio.errorCarga() || this.causas().length === 0) {
      this.avisos.mostrar(
        'error',
        'No hay causas disponibles; reintenta cargar el catálogo antes de registrar.',
      );
      return;
    }
    if (this.errorEvidencia() !== null) {
      this.avisos.mostrar('error', this.errorEvidencia() as string);
      return;
    }
    if (this.forma.invalid) {
      this.forma.markAllAsTouched();
      this.avisos.mostrar('advertencia', 'Revisa los campos marcados antes de continuar.');
      return;
    }

    const valores = this.forma.getRawValue();
    const datos: DatosNuevaMerma = {
      origen: valores.origen,
      materialId: valores.materialId,
      color: valores.color,
      loteId: valores.loteId,
      sku: valores.sku,
      cantidad: valores.cantidad ?? 0,
      etapa: valores.etapa as EtapaMerma,
      causaId: valores.causaId ?? 0,
      ordenFolio: valores.ordenFolio,
      descripcion: valores.descripcion,
      evidenciaNombre: valores.evidenciaNombre,
    };
    this.enviando.set(true);
    this.servicio.registrar(datos).subscribe((resultado) => {
      this.enviando.set(false);
      this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
      if (!resultado.ok) {
        return;
      }
      this.ultimoFolio.set(resultado.folio ?? null);
      this.forma.controls.cantidad.reset(null);
      this.forma.controls.descripcion.reset('');
      this.forma.controls.evidenciaNombre.reset(null);
      this.forma.controls.ordenFolio.reset('');
      this.errorEvidencia.set(null);
    });
  }

  protected etiquetaEtapaForma(): string {
    const valor = this.forma.controls.etapa.value;
    return valor === '' ? 'Sin definir' : ETIQUETAS_ETAPA[valor];
  }
}
