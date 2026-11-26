import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { mensajeError } from '../../../../core/api/errores';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { ChipEstatus } from '../../componentes/chip-estatus/chip-estatus';
import { NavegacionProveedores } from '../../componentes/navegacion-proveedores/navegacion-proveedores';
import { ProveedoresServicio } from '../../servicios/proveedores-servicio';
import type { EstadoProveedor, Proveedor } from '../../modelos/proveedor';

@Component({
  selector: 'app-padron',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    RouterLink,
    ChipEstatus,
    NavegacionProveedores,
    ModalConfirmacion,
  ],
  templateUrl: './padron.html',
  styleUrl: './padron.css',
})
export class Padron {
  protected readonly servicio = inject(ProveedoresServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly busqueda = signal('');
  protected readonly estatusFiltro = signal<EstadoProveedor | 'TODOS'>('TODOS');
  protected readonly proveedorAEliminar = signal<Proveedor | null>(null);
  protected readonly cargando = this.servicio.cargando;

  protected readonly opcionesEstatus: { valor: EstadoProveedor | 'TODOS'; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos' },
    { valor: 'ACTIVO', etiqueta: 'Activos' },
    { valor: 'EN_REVISION', etiqueta: 'En revisión' },
    { valor: 'INACTIVO', etiqueta: 'Inactivos' },
  ];

  protected readonly proveedores = this.servicio.proveedores;

  protected readonly filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const estatus = this.estatusFiltro();

    return this.proveedores().filter((proveedor) => {
      const coincideEstatus = estatus === 'TODOS' || proveedor.estatus === estatus;
      const coincideTexto =
        termino === '' ||
        proveedor.razonSocial.toLowerCase().includes(termino) ||
        proveedor.nombreComercial.toLowerCase().includes(termino) ||
        (proveedor.rfc ?? '').toLowerCase().includes(termino) ||
        proveedor.materiales.some((material) => material.material.toLowerCase().includes(termino));

      return coincideEstatus && coincideTexto;
    });
  });

  protected readonly totales = computed(() => {
    const lista = this.proveedores();
    return {
      todos: lista.length,
      activos: lista.filter((proveedor) => proveedor.estatus === 'ACTIVO').length,
      revision: lista.filter((proveedor) => proveedor.estatus === 'EN_REVISION').length,
      inactivos: lista.filter((proveedor) => proveedor.estatus === 'INACTIVO').length,
    };
  });

  protected alBuscar(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.busqueda.set(entrada.value);
  }

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  protected plazoProveedor(proveedor: Proveedor): number {
    const activos = proveedor.materiales.filter((material) => material.activo);
    return activos.length === 0 ? 0 : Math.min(...activos.map((material) => material.plazoDias));
  }

  protected minimoProveedor(proveedor: Proveedor): number {
    const activos = proveedor.materiales.filter((material) => material.activo);
    return activos.length === 0 ? 0 : Math.min(...activos.map((material) => material.minimoCompra));
  }

  protected evaluacion(proveedor: Proveedor) {
    return this.servicio.obtenerEvaluacion(proveedor.id);
  }

  protected nivelEntrega(proveedor: Proveedor): 'bueno' | 'alerta' | 'sin-datos' {
    const evaluacion = this.evaluacion(proveedor);
    if (!evaluacion || evaluacion.ordenesRecibidas === 0) {
      return 'sin-datos';
    }
    return evaluacion.entregasATiempoPct < 80 ? 'alerta' : 'bueno';
  }

  protected confirmarEliminacion(): void {
    const proveedor = this.proveedorAEliminar();
    if (!proveedor) {
      return;
    }

    this.servicio.eliminarProveedor(proveedor.id).subscribe({
      next: (resultado) => {
        this.proveedorAEliminar.set(null);
        this.avisos.mostrar(
          resultado === 'desactivado' ? 'advertencia' : 'exito',
          resultado === 'desactivado'
            ? `${proveedor.nombreComercial} tiene historial: Flask lo desactivó.`
            : `${proveedor.nombreComercial} se eliminó del padrón en Flask.`,
        );
      },
      error: (error: unknown) => this.avisos.mostrar('error', mensajeError(error)),
    });
  }
}
