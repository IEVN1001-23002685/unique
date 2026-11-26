import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionProduccion } from '../../componentes/navegacion-produccion/navegacion-produccion';
import type { FilaPlanSugerido } from '../../modelos/produccion';
import { ProduccionServicio } from '../../servicios/produccion-servicio';

@Component({
  selector: 'app-plan-sugerido',
  imports: [DecimalPipe, RouterLink, NavegacionProduccion],
  templateUrl: './plan-sugerido.html',
  styleUrls: ['./plan-sugerido.css', '../../produccion-compartido.css'],
})
export class PlanSugerido {
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosServicio);

  protected readonly servicio = inject(ProduccionServicio);
  protected readonly soloSugeridas = signal(false);

  protected readonly filas = computed(() => {
    const todas = this.servicio.planSugerido();
    return this.soloSugeridas() ? todas.filter((fila) => fila.cantidadSugerida > 0) : todas;
  });

  protected readonly totalSugerido = computed(() =>
    this.filas().reduce((suma, fila) => suma + fila.cantidadSugerida, 0),
  );

  protected readonly conSugerencia = computed(
    () => this.servicio.planSugerido().filter((fila) => fila.cantidadSugerida > 0).length,
  );

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }

  protected puedeCrear(fila: FilaPlanSugerido): boolean {
    return (
      fila.cantidadSugerida > 0 &&
      fila.ordenAbiertaFolio === null &&
      !!fila.varianteId &&
      fila.varianteId > 0 &&
      !this.servicio.errorCarga()
    );
  }

  protected crearDesdePlan(fila: FilaPlanSugerido): void {
    if (!this.puedeCrear(fila)) {
      if (fila.ordenAbiertaFolio) {
        this.avisos.mostrar(
          'informacion',
          `Ya existe la orden ${fila.ordenAbiertaFolio}: Flask debe sumar la demanda a esa orden.`,
        );
      }
      return;
    }
    const varianteId = fila.varianteId;
    if (varianteId === undefined || varianteId <= 0) {
      return;
    }
    this.servicio
      .crearOrden({
        lineas: [
          {
            varianteId,
            sku: fila.sku,
            nombreProducto: fila.nombreProducto,
            cantidad: fila.cantidadSugerida,
          },
        ],
        fechaRequerida: null,
        notas: `Sugerencia de M16: pendiente no cubierto ${fila.pendienteNoCubierto}, reposición ${fila.cantidadReposicion}.`,
      })
      .subscribe((resultado) => {
        this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
        if (!resultado.ok || !resultado.folio) {
          return;
        }
        const destino = this.servicio.ordenes().find((orden) => orden.folio === resultado.folio)?.id;
        if (destino !== undefined) {
          void this.router.navigate(['/produccion', destino]);
        }
      });
  }
}
