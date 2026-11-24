import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import {
  AdministracionSistemaServicio,
} from '../../servicios/administracion-sistema-servicio';
import {
  ETIQUETAS_APLICA,
  ETIQUETAS_TIPO_CATALOGO,
  TIPOS_CATALOGO,
  mxn,
  type AplicaCausaMerma,
  type DatosCatalogo,
  type EntradaCatalogo,
  type TipoCatalogo,
} from '../../modelos/administracion';

/** Catálogos del sistema: seis colecciones con reglas propias por tipo. */
@Component({
  selector: 'app-catalogos-sistema',
  imports: [ReactiveFormsModule, ModalConfirmacion],
  templateUrl: './catalogos.html',
  styleUrls: ['../../estilos-compartidos.css', './catalogos.css'],
})
export class Catalogos {
  protected readonly servicio = inject(AdministracionSistemaServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly fb = inject(FormBuilder);

  protected readonly tipos = TIPOS_CATALOGO;
  protected readonly etiquetasTipo = ETIQUETAS_TIPO_CATALOGO;
  protected readonly etiquetasAplica = ETIQUETAS_APLICA;

  protected readonly formulario = this.fb.nonNullable.group({
    tipo: this.fb.nonNullable.control<TipoCatalogo>('COLOR', Validators.required),
    codigo: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: ['', Validators.maxLength(160)],
    activo: [true],
    hex: ['#FFFFFF', Validators.pattern(/^#[0-9A-Fa-f]{6}$/)],
    orden: [1, [Validators.required, Validators.min(1)]],
    prefijo: ['', [Validators.pattern(/^[A-Za-z]{2}$/)]],
    usaTallas: [true],
    aplicaA: this.fb.nonNullable.control<AplicaCausaMerma | ''>(''),
    etapaSugerida: [''],
    cpInicio: ['', Validators.pattern(/^\d{5}$/)],
    cpFin: ['', Validators.pattern(/^\d{5}$/)],
    costo: [0, [Validators.min(0)]],
    diasEstimados: [1, [Validators.min(1)]],
  });

  protected readonly tipoSeleccionado = signal<TipoCatalogo>('COLOR');
  protected readonly editando = signal<number | null>(null);
  protected readonly errorFormulario = signal<string | null>(null);
  protected readonly pendiente = signal<EntradaCatalogo | null>(null);

  constructor() {
    this.formulario.controls.tipo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((tipo) => {
        this.tipoSeleccionado.set(tipo);
        this.cancelar();
      });
  }

  protected entradas(): EntradaCatalogo[] {
    return this.servicio.entradasDe(this.tipoSeleccionado());
  }

  protected codigoBloqueado(): boolean {
    const id = this.editando();
    if (id === null) {
      return false;
    }
    const entrada = this.entradas().find((item) => item.id === id);
    return entrada
      ? this.servicio.codigoUsadoEnSku(entrada.tipo, entrada.codigo) &&
          (entrada.tipo === 'COLOR' || entrada.tipo === 'TALLA' || entrada.tipo === 'CATEGORIA_PRODUCTO')
      : false;
  }

  protected nuevo(): void {
    this.editando.set(null);
    this.errorFormulario.set(null);
    this.formulario.reset(undefined, { emitEvent: false });
    this.formulario.patchValue(
      {
        tipo: this.tipoSeleccionado(),
        hex: '#FFFFFF',
        orden: this.entradas().length + 1,
        usaTallas: true,
        costo: 0,
        diasEstimados: 1,
      },
      { emitEvent: false },
    );
  }

  protected editar(entrada: EntradaCatalogo): void {
    this.editando.set(entrada.id);
    this.errorFormulario.set(null);
    this.formulario.reset(undefined, { emitEvent: false });
    this.formulario.patchValue(
      {
        tipo: entrada.tipo,
        codigo: entrada.codigo,
        nombre: entrada.nombre,
        descripcion: entrada.descripcion,
        activo: entrada.activo,
        hex: entrada.hex ?? '#FFFFFF',
        orden: entrada.orden ?? 1,
        prefijo: entrada.prefijo ?? entrada.codigo,
        usaTallas: entrada.usaTallas ?? false,
        aplicaA: entrada.aplicaA ?? '',
        etapaSugerida: entrada.etapaSugerida ?? '',
        cpInicio: entrada.cpInicio ?? '',
        cpFin: entrada.cpFin ?? '',
        costo: entrada.costo ?? 0,
        diasEstimados: entrada.diasEstimados ?? 1,
      },
      { emitEvent: false },
    );
    this.tipoSeleccionado.set(entrada.tipo);
  }

  protected cancelar(): void {
    this.editando.set(null);
    this.errorFormulario.set(null);
  }

  protected guardar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) {
      this.errorFormulario.set('Revisa los campos marcados antes de guardar.');
      return;
    }
    const valor = this.formulario.getRawValue();
    const datos: DatosCatalogo = {
      tipo: valor.tipo,
      codigo: valor.codigo,
      nombre: valor.nombre,
      descripcion: valor.descripcion,
      activo: valor.activo,
      hex: valor.hex,
      orden: valor.orden,
      prefijo: valor.prefijo,
      usaTallas: valor.usaTallas,
      aplicaA: valor.aplicaA,
      etapaSugerida: valor.etapaSugerida,
      cpInicio: valor.cpInicio,
      cpFin: valor.cpFin,
      costo: valor.costo,
      diasEstimados: valor.diasEstimados,
    };
    const resultado = this.servicio.guardarEntradaCatalogo(datos, this.editando() ?? undefined);
    this.errorFormulario.set(resultado.ok ? null : resultado.mensaje);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok) {
      this.cancelar();
    }
  }

  protected pedirDesactivacion(entrada: EntradaCatalogo): void {
    this.pendiente.set(entrada);
  }

  protected confirmarDesactivacion(): void {
    const entrada = this.pendiente();
    this.pendiente.set(null);
    if (!entrada) {
      return;
    }
    const resultado = this.servicio.desactivarEntrada(entrada.id);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok && this.editando() === entrada.id) {
      this.cancelar();
    }
  }

  protected cancelarDesactivacion(): void {
    this.pendiente.set(null);
  }

  protected formatoMXN(valor: number): string {
    return mxn(valor);
  }

  protected errorEn(
    control: 'codigo' | 'nombre' | 'hex' | 'orden' | 'prefijo' | 'cpInicio' | 'cpFin' | 'costo' | 'diasEstimados',
  ): boolean {
    const campo = this.formulario.controls[control];
    return campo.invalid && (campo.touched || campo.dirty);
  }
}
