import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  type FormControl,
  type FormGroup,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ChipEstadoProduccion } from '../../componentes/chip-estado-produccion/chip-estado-produccion';
import { NavegacionProduccion } from '../../componentes/navegacion-produccion/navegacion-produccion';
import {
  ETAPAS_MERMA,
  ETIQUETAS_ETAPA_MERMA,
  type EtapaMerma,
  type LineaDictamen,
  type OrdenVista,
  type RevisionCalidad as Revision,
} from '../../modelos/produccion';
import { ProduccionServicio } from '../../servicios/produccion-servicio';
import { enteroNoNegativo } from '../../validadores/cantidad-entera';

type LineaForm = FormGroup<{
  medidasOk: FormControl<boolean>;
  costurasOk: FormControl<boolean>;
  bordadoOk: FormControl<boolean>;
  etiquetasOk: FormControl<boolean>;
  cantidadRevisada: FormControl<number | null>;
  cantidadAprobada: FormControl<number | null>;
  cantidadReproceso: FormControl<number | null>;
  cantidadMerma: FormControl<number | null>;
  causaMerma: FormControl<string>;
  etapaMerma: FormControl<EtapaMerma>;
}>;

interface FilaDictamen {
  sku: string;
  pendiente: number;
  revisada: number;
  aprobada: number;
  reproceso: number;
  merma: number;
  total: number;
  excede: boolean;
  verificacionIncompleta: boolean;
  mermaSinCausa: boolean;
  sinDictamen: boolean;
  valida: boolean;
}

@Component({
  selector: 'app-revision-calidad',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    NavegacionProduccion,
    ChipEstadoProduccion,
  ],
  templateUrl: './revision-calidad.html',
  styleUrls: ['./revision-calidad.css', '../../produccion-compartido.css'],
})
export class RevisionCalidad {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosServicio);

  protected readonly servicio = inject(ProduccionServicio);
  protected readonly etapas = ETAPAS_MERMA;
  protected readonly etiquetasEtapa = ETIQUETAS_ETAPA_MERMA;

  private readonly idRuta = toSignal(
    this.ruta.paramMap.pipe(map((params) => Number(params.get('id') ?? 0))),
    { initialValue: Number(this.ruta.snapshot.paramMap.get('id') ?? 0) },
  );

  protected readonly orden = computed<OrdenVista | undefined>(() => {
    const id = this.idRuta();
    return id > 0 ? this.servicio.vistaPorId(id) : undefined;
  });

  protected readonly candidatas = computed(() =>
    this.servicio.vistas().filter((orden) => ['EN_REVISION', 'EN_PROCESO'].includes(orden.estado)),
  );

  protected readonly revisiones = computed(() => this.servicio.revisiones().slice(0, 5));

  readonly form = this.fb.group({
    lineas: this.fb.array<LineaForm>([]),
  });

  /** Señal de sincronización: cada cambio del formulario recalcula las filas. */
  private readonly cambios = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly filas = computed<FilaDictamen[]>(() => {
    this.cambios();
    const orden = this.orden();
    if (!orden) {
      return [];
    }
    return orden.lineas.map((linea, indice) => {
      const grupo = this.lineas.controls[indice];
      const valor = grupo.getRawValue();
      const pendiente = linea.cantidadPlaneada - linea.cantidadAprobada - linea.cantidadMerma;
      const revisada = valor.cantidadRevisada ?? 0;
      const aprobada = valor.cantidadAprobada ?? 0;
      const reproceso = valor.cantidadReproceso ?? 0;
      const merma = valor.cantidadMerma ?? 0;
      const total = aprobada + reproceso + merma;
      const excede = revisada > pendiente || total > revisada;
      const verificacionIncompleta =
        !valor.medidasOk || !valor.costurasOk || !valor.bordadoOk || !valor.etiquetasOk;
      const mermaSinCausa = merma > 0 && valor.causaMerma.trim() === '';
      const sinDictamen = total === 0;

      return {
        sku: linea.sku,
        pendiente,
        revisada,
        aprobada,
        reproceso,
        merma,
        total,
        excede,
        verificacionIncompleta,
        mermaSinCausa,
        sinDictamen,
        valida: !excede && !verificacionIncompleta && !mermaSinCausa && !sinDictamen,
      };
    });
  });

  protected readonly puedeGuardar = computed(
    () =>
      this.orden()?.estado === 'EN_REVISION' &&
      this.filas().length > 0 &&
      this.filas().every((fila) => fila.valida),
  );

  constructor() {
    effect(() => {
      const orden = this.orden();
      this.form.setControl(
        'lineas',
        this.fb.array(
          (orden?.lineas ?? []).map((linea) => {
            const pendiente = linea.cantidadPlaneada - linea.cantidadAprobada - linea.cantidadMerma;
            return this.fb.group({
              medidasOk: this.fb.control(true),
              costurasOk: this.fb.control(true),
              bordadoOk: this.fb.control(true),
              etiquetasOk: this.fb.control(true),
              cantidadRevisada: this.fb.control<number | null>(pendiente),
              cantidadAprobada: this.fb.control<number | null>(0, enteroNoNegativo),
              cantidadReproceso: this.fb.control<number | null>(0, enteroNoNegativo),
              cantidadMerma: this.fb.control<number | null>(0, enteroNoNegativo),
              causaMerma: this.fb.control<string>(''),
              etapaMerma: this.fb.control<EtapaMerma>('CORTE'),
            }) as LineaForm;
          }),
        ),
      );
    });
  }

  protected get lineas(): FormArray<LineaForm> {
    return this.form.controls.lineas;
  }

  protected skus(orden: OrdenVista): string {
    return orden.lineas.map((linea) => linea.sku).join(', ');
  }

  protected aprobadas(revision: Revision): number {
    return revision.lineas.reduce((suma, linea) => suma + linea.cantidadAprobada, 0);
  }

  protected merma(revision: Revision): number {
    return revision.lineas.reduce((suma, linea) => suma + linea.cantidadMerma, 0);
  }

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  protected guardar(): void {
    const orden = this.orden();
    if (!orden || !this.puedeGuardar()) {
      this.avisos.mostrar(
        'error',
        'Completa la lista de verificación y las cantidades de todas las líneas antes de dictaminar.',
      );
      return;
    }

    const dictamenes: LineaDictamen[] = orden.lineas.map((linea, indice) => {
      const valor = this.lineas.controls[indice].getRawValue();
      return {
        lineaId: linea.id,
        sku: linea.sku,
        medidasOk: valor.medidasOk,
        costurasOk: valor.costurasOk,
        bordadoOk: valor.bordadoOk,
        etiquetasOk: valor.etiquetasOk,
        cantidadRevisada: valor.cantidadRevisada ?? 0,
        cantidadAprobada: valor.cantidadAprobada ?? 0,
        cantidadReproceso: valor.cantidadReproceso ?? 0,
        cantidadMerma: valor.cantidadMerma ?? 0,
        causaMerma: valor.causaMerma.trim(),
        etapaMerma: valor.etapaMerma,
      };
    });

    this.servicio.dictaminar(orden.id, dictamenes).subscribe((resultado) => {
      this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
      if (resultado.ok) {
        void this.router.navigate(['/produccion', orden.id]);
      }
    });
  }
}
