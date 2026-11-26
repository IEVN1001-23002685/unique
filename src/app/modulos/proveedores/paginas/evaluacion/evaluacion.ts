import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChipEstatus } from '../../componentes/chip-estatus/chip-estatus';
import { NavegacionProveedores } from '../../componentes/navegacion-proveedores/navegacion-proveedores';
import { ProveedoresServicio } from '../../servicios/proveedores-servicio';
import type { EvaluacionProveedor, Proveedor } from '../../modelos/proveedor';

interface FilaEvaluacion {
  proveedor: Proveedor;
  evaluacion: EvaluacionProveedor | undefined;
}

@Component({
  selector: 'app-evaluacion',
  imports: [DecimalPipe, RouterLink, ChipEstatus, NavegacionProveedores],
  templateUrl: './evaluacion.html',
  styleUrl: './evaluacion.css',
})
export class Evaluacion {
  private readonly servicio = inject(ProveedoresServicio);

  protected readonly busqueda = signal('');
  protected readonly soloRevision = signal(false);
  protected readonly minimoATiempo = 80;
  protected readonly cargando = this.servicio.cargando;
  protected readonly errorCarga = this.servicio.errorCarga;
  protected readonly errorDetalle = this.servicio.errorDetalle;

  protected readonly filas = computed<FilaEvaluacion[]>(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const revision = this.soloRevision();

    return this.servicio
      .proveedores()
      .map((proveedor) => ({
        proveedor,
        evaluacion: this.servicio.obtenerEvaluacion(proveedor.id),
      }))
      .filter((fila) => {
        const coincideTexto =
          termino === '' ||
          fila.proveedor.razonSocial.toLowerCase().includes(termino) ||
          fila.proveedor.nombreComercial.toLowerCase().includes(termino);
        const coincideRevision =
          !revision || (fila.evaluacion?.entregasATiempoPct ?? 100) < this.minimoATiempo;
        return coincideTexto && coincideRevision;
      });
  });

  protected readonly proveedoresEnRevision = computed(() =>
    this.servicio
      .proveedores()
      .filter(
        (proveedor) =>
          (this.servicio.obtenerEvaluacion(proveedor.id)?.entregasATiempoPct ?? 100) <
          this.minimoATiempo,
      ),
  );

  /** Flask recalcula la métrica a diario; aquí solo se documenta el desface de estatus. */
  protected readonly pendientesRevision = computed(() =>
    this.proveedoresEnRevision().filter((proveedor) => proveedor.estatus !== 'EN_REVISION'),
  );

  protected alBuscar(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.busqueda.set(entrada.value);
  }

  protected alCambiarRevision(evento: Event): void {
    const casilla = evento.target as HTMLInputElement;
    this.soloRevision.set(casilla.checked);
  }

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  protected nivel(promedio: number | undefined): 'bueno' | 'alerta' | 'sin-datos' {
    if (promedio === undefined) {
      return 'sin-datos';
    }
    return promedio < this.minimoATiempo ? 'alerta' : 'bueno';
  }
}
