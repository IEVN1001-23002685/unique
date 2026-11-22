import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionVentas } from '../../componentes/navegacion-ventas/navegacion-ventas';
import { VentasServicio, fechaHoyIso } from '../../servicios/ventas-servicio';
import type { AplicacionDescuento, Descuento, TipoDescuento } from '../../modelos/venta';

@Component({
  selector: 'app-formulario-descuento',
  imports: [ReactiveFormsModule, RouterLink, NavegacionVentas],
  templateUrl: './formulario-descuento.html',
  styleUrl: './formulario-descuento.css',
})
export class FormularioDescuento {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosServicio);
  protected readonly servicio = inject(VentasServicio);

  private readonly parametroId = this.ruta.snapshot.paramMap.get('id');
  protected readonly idEditar =
    this.parametroId !== null && /^\d+$/.test(this.parametroId) ? Number(this.parametroId) : 0;
  protected readonly esEdicion = this.idEditar > 0;
  protected readonly noEncontrado = signal(false);
  protected readonly intentoEnvio = signal(false);

  protected readonly formulario = this.fb.group({
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]),
    codigo: this.fb.nonNullable.control(''),
    tipo: this.fb.nonNullable.control<TipoDescuento>('PORCENTAJE', [Validators.required]),
    valor: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0.01)]),
    aplicacion: this.fb.nonNullable.control<AplicacionDescuento>('AUTOMATICO', [
      Validators.required,
    ]),
    soloPrimeraCompra: this.fb.nonNullable.control(false),
    montoMinimo: this.fb.control<number | null>(null),
    minArticulos: this.fb.control<number | null>(null),
    vigenteDesde: this.fb.nonNullable.control(fechaHoyIso(), [Validators.required]),
    vigenteHasta: this.fb.control<string | null>(null),
    usosMaximos: this.fb.control<number | null>(null),
    usosPorCliente: this.fb.nonNullable.control(1, [Validators.required, Validators.min(1)]),
    activo: this.fb.nonNullable.control(true),
  });

  constructor() {
    if (!this.esEdicion) {
      return;
    }

    const descuento = this.servicio.obtenerDescuento(this.idEditar);
    if (!descuento) {
      this.noEncontrado.set(true);
      return;
    }

    this.formulario.patchValue({
      nombre: descuento.nombre,
      codigo: descuento.codigo ?? '',
      tipo: descuento.tipo,
      valor: descuento.valor,
      aplicacion: descuento.aplicacion,
      soloPrimeraCompra: descuento.soloPrimeraCompra,
      montoMinimo: descuento.montoMinimo,
      minArticulos: descuento.minArticulos,
      vigenteDesde: descuento.vigenteDesde,
      vigenteHasta: descuento.vigenteHasta,
      usosMaximos: descuento.usosMaximos,
      usosPorCliente: descuento.usosPorCliente,
      activo: descuento.activo,
    });
  }

  protected esInvalido(campo: string): boolean {
    const control = this.formulario.get(campo);
    return control !== null && control.invalid && (control.touched || this.intentoEnvio());
  }

  protected guardar(): void {
    this.intentoEnvio.set(true);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valor = this.formulario.getRawValue();
    if (valor.tipo === 'PORCENTAJE' && valor.valor > 100) {
      this.avisos.mostrar('error', 'Un porcentaje no puede ser mayor a 100 %.');
      return;
    }
    if (valor.vigenteHasta !== null && valor.vigenteHasta < valor.vigenteDesde) {
      this.avisos.mostrar('error', 'La vigencia final no puede ser anterior a la inicial.');
      return;
    }

    const previo = this.esEdicion ? this.servicio.obtenerDescuento(this.idEditar) : undefined;
    if (valor.usosMaximos !== null && previo && valor.usosMaximos < previo.usosActuales) {
      this.avisos.mostrar(
        'error',
        `El límite no puede ser menor a los ${previo.usosActuales} usos ya registrados.`,
        );
      return;
    }

    const positivoONulo = (numero: number | null): number | null =>
      numero === null || numero <= 0 ? null : numero;

    const descuento: Descuento = {
      id: this.esEdicion ? this.idEditar : 0,
      nombre: valor.nombre.trim(),
      codigo: valor.codigo.trim() === '' ? null : valor.codigo.trim().toUpperCase(),
      tipo: valor.tipo,
      valor: valor.valor,
      aplicacion: valor.aplicacion,
      soloPrimeraCompra: valor.soloPrimeraCompra,
      montoMinimo: positivoONulo(valor.montoMinimo),
      minArticulos: positivoONulo(valor.minArticulos),
      vigenteDesde: valor.vigenteDesde,
      vigenteHasta: valor.vigenteHasta,
      usosMaximos: positivoONulo(valor.usosMaximos),
      usosPorCliente: valor.usosPorCliente,
      usosActuales: previo?.usosActuales ?? 0,
      activo: valor.activo,
    };

    this.servicio.guardarDescuento(descuento);
    this.avisos.mostrar(
      'exito',
      `${descuento.nombre} se guardó solo en memoria (demostración). Persistencia pendiente de Flask.`,
    );
    this.router.navigate(['/ventas/descuentos']);
  }
}
