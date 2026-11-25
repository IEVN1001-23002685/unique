import { CurrencyPipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { decimalPositivo } from '../../../../compartido/validadores/validadores-negocio';
import { mensajeError } from '../../../../core/api/errores';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionCompras } from '../../componentes/navegacion-compras/navegacion-compras';
import type { LineaOrdenCompra, OrdenCompra } from '../../modelos/compra';
import { ComprasServicio, redondear4 } from '../../servicios/compras-servicio';

@Component({
  selector: 'app-formulario-orden',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, NavegacionCompras],
  templateUrl: './formulario-orden.html',
  styleUrls: ['./formulario-orden.css', '../../compras-compartido.css'],
})
export class FormularioOrden {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosServicio);
  protected readonly servicio = inject(ComprasServicio);

  protected readonly materiales = this.servicio.materiales;
  protected readonly proveedores = this.servicio.proveedoresDisponibles;
  protected readonly condicionesPago = [
    'Contado',
    'Crédito 15 días',
    'Crédito 30 días',
    'Crédito 45 días',
  ];
  protected readonly intentoEnvio = signal(false);
  protected readonly noEncontrado = signal(false);
  protected readonly soloLectura = signal(false);

  private readonly parametroId = this.ruta.snapshot.paramMap.get('id');
  protected readonly idEditar =
    this.parametroId !== null && /^\d+$/.test(this.parametroId) ? Number(this.parametroId) : 0;

  protected readonly formulario = this.fb.nonNullable.group({
    proveedorId: [0, [Validators.required]],
    condicionesPago: ['Contado', [Validators.required]],
    fechaPrometida: ['', [Validators.required]],
    notas: [''],
    lineas: this.fb.nonNullable.array([this.nuevaLinea()]),
  });

  private formularioInicializado = false;

  constructor() {
    effect(() => {
      if (this.formularioInicializado || !this.servicio.cargado()) {
        return;
      }
      const orden = this.servicio.obtenerOrden(this.idEditar);
      if (!orden) {
        this.noEncontrado.set(true);
        return;
      }
      this.formularioInicializado = true;
      this.formulario.patchValue({
        proveedorId: orden.proveedorId,
        condicionesPago: orden.condicionesPago,
        fechaPrometida: orden.fechaPrometida ?? '',
        notas: orden.notas ?? '',
      });
      this.formulario.controls.lineas.clear();
      for (const linea of orden.lineas) {
        this.formulario.controls.lineas.push(this.nuevaLinea(linea));
      }
      // El material de una línea ya pactada no se cambia desde esta pantalla.
      for (const control of this.formulario.controls.lineas.controls) {
        control.controls.materialId.disable();
      }

      if (orden.estado !== 'BORRADOR') {
        this.soloLectura.set(true);
        this.formulario.disable();
      }
    });
  }

  protected materialDe(indice: number) {
    const id = this.formulario.controls.lineas.at(indice).controls.materialId.value;
    return this.servicio.obtenerMaterial(id);
  }

  protected subtotal(indice: number): number {
    const linea = this.formulario.controls.lineas.at(indice).controls;
    return redondear4(linea.cantidadCompra.value * linea.precioUnitarioCompra.value);
  }

  protected total(): number {
    return redondear4(
      this.formulario.controls.lineas.controls.reduce(
        (suma, _, indice) => suma + this.subtotal(indice),
        0,
      ),
    );
  }

  protected basePedida(indice: number): number {
    const linea = this.formulario.controls.lineas.at(indice).controls;
    return this.servicio.basePresentaciones(linea.materialId.value, linea.cantidadCompra.value);
  }

  protected esInvalido(campo: 'proveedorId' | 'fechaPrometida'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.intentoEnvio());
  }

  protected lineaInvalida(
    indice: number,
    campo: 'cantidadCompra' | 'precioUnitarioCompra',
  ): boolean {
    const control = this.formulario.controls.lineas.at(indice).controls[campo];
    return control.invalid && (control.touched || this.intentoEnvio());
  }

  protected guardar(): void {
    this.intentoEnvio.set(true);
    if (this.formulario.invalid || this.soloLectura()) {
      this.formulario.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa proveedor, fecha prometida y precios antes de guardar.');
      return;
    }

    const previo = this.servicio.obtenerOrden(this.idEditar);
    if (!previo) {
      return;
    }

    const valor = this.formulario.getRawValue();
    const orden: OrdenCompra = {
      ...structuredClone(previo),
      proveedorId: valor.proveedorId,
      condicionesPago: valor.condicionesPago,
      fechaPrometida: valor.fechaPrometida,
      notas: valor.notas.trim() === '' ? null : valor.notas.trim(),
      lineas: valor.lineas.map((linea, indice): LineaOrdenCompra => ({
        id: previo.lineas[indice]?.id ?? 0,
        materialId: linea.materialId,
        cantidadCompra: Math.max(1, Math.floor(linea.cantidadCompra)),
        cantidadBasePedida: 0,
        precioUnitarioCompra: redondear4(linea.precioUnitarioCompra),
        subtotal: 0,
        cantidadBaseAceptada: previo.lineas[indice]?.cantidadBaseAceptada ?? 0,
      })),
    };

    this.servicio.guardarOrden(orden).subscribe({
      next: (guardada) => {
        if (!guardada) {
          this.avisos.mostrar('error', 'Flask no pudo actualizar la orden.');
          return;
        }
        this.avisos.mostrar(
          'exito',
          `${guardada.folio} se actualizó en Flask; emítela cuando el precio y plazo estén listos.`,
        );
        void this.router.navigate(['/compras/ordenes']);
      },
      error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
    });
  }

  private nuevaLinea(linea?: LineaOrdenCompra) {
    return this.fb.nonNullable.group({
      materialId: [linea?.materialId ?? 1, [Validators.required]],
      cantidadCompra: [linea?.cantidadCompra ?? 1, [Validators.required, Validators.min(1)]],
      precioUnitarioCompra: [
        linea?.precioUnitarioCompra ?? 0,
        [Validators.required, decimalPositivo],
      ],
    });
  }
}
