import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { rfcValido, telefono10 } from '../../../../compartido/validadores/validadores-negocio';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionProveedores } from '../../componentes/navegacion-proveedores/navegacion-proveedores';
import { ProveedoresServicio } from '../../servicios/proveedores-servicio';
import type { EstadoProveedor, Proveedor } from '../../modelos/proveedor';

@Component({
  selector: 'app-formulario-proveedor',
  imports: [ReactiveFormsModule, RouterLink, NavegacionProveedores],
  templateUrl: './formulario-proveedor.html',
  styleUrl: './formulario-proveedor.css',
})
export class FormularioProveedor {
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly servicio = inject(ProveedoresServicio);
  private readonly avisos = inject(AvisosServicio);

  private readonly parametroId = this.ruta.snapshot.paramMap.get('id');
  protected readonly idEditar =
    this.parametroId !== null && /^\d+$/.test(this.parametroId) ? Number(this.parametroId) : 0;
  protected readonly esEdicion = this.idEditar > 0;
  protected readonly noEncontrado = signal(false);
  protected readonly intentoEnvio = signal(false);

  protected readonly condicionesPago = [
    'Contado',
    'Crédito 15 días',
    'Crédito 30 días',
    'Crédito 45 días',
  ];
  protected readonly estatusPosibles: EstadoProveedor[] = ['ACTIVO', 'EN_REVISION', 'INACTIVO'];

  protected readonly formulario = this.fb.nonNullable.group({
    razonSocial: ['', [Validators.required, Validators.minLength(3)]],
    nombreComercial: ['', [Validators.required, Validators.minLength(2)]],
    rfc: ['', [rfcValido]],
    contacto: ['', [Validators.required]],
    telefono: ['', [Validators.required, telefono10]],
    correo: ['', [Validators.required, Validators.email]],
    direccion: ['', [Validators.required]],
    condicionesPago: ['Crédito 30 días', [Validators.required]],
    estatus: ['ACTIVO' as EstadoProveedor, [Validators.required]],
    notas: [''],
  });

  constructor() {
    if (!this.esEdicion) {
      return;
    }

    const proveedor = this.servicio.obtenerPorId(this.idEditar);
    if (!proveedor) {
      this.noEncontrado.set(true);
      return;
    }

    this.formulario.patchValue({
      razonSocial: proveedor.razonSocial,
      nombreComercial: proveedor.nombreComercial,
      rfc: proveedor.rfc ?? '',
      contacto: proveedor.contacto,
      telefono: proveedor.telefono,
      correo: proveedor.correo,
      direccion: proveedor.direccion,
      condicionesPago: proveedor.condicionesPago,
      estatus: proveedor.estatus,
      notas: proveedor.notas ?? '',
    });
  }

  protected esInvalido(campo: string): boolean {
    const control = this.formulario.get(campo);
    return control !== null && control.invalid && (control.touched || this.intentoEnvio());
  }

  protected etiquetaEstatus(estatus: EstadoProveedor): string {
    if (estatus === 'ACTIVO') {
      return 'Activo';
    }
    return estatus === 'EN_REVISION' ? 'En revisión' : 'Inactivo';
  }

  protected guardar(): void {
    this.intentoEnvio.set(true);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valor = this.formulario.getRawValue();
    const previo = this.esEdicion ? this.servicio.obtenerPorId(this.idEditar) : undefined;

    const proveedor: Proveedor = {
      id: this.esEdicion ? this.idEditar : 0,
      razonSocial: valor.razonSocial.trim(),
      nombreComercial: valor.nombreComercial.trim(),
      rfc: valor.rfc.trim() === '' ? null : valor.rfc.trim().toUpperCase(),
      contacto: valor.contacto.trim(),
      telefono: valor.telefono.trim(),
      correo: valor.correo.trim(),
      direccion: valor.direccion.trim(),
      condicionesPago: valor.condicionesPago,
      estatus: valor.estatus,
      notas: valor.notas.trim() === '' ? null : valor.notas.trim(),
      tieneOrdenesCompra: previo?.tieneOrdenesCompra ?? false,
      materiales: previo?.materiales ?? [],
    };

    this.servicio.guardarProveedor(proveedor);
    this.avisos.mostrar(
      'exito',
      `${proveedor.nombreComercial} se guardó solo en memoria (demostración). Persistencia pendiente de Flask.`,
    );
    this.router.navigate(['/proveedores']);
  }
}
