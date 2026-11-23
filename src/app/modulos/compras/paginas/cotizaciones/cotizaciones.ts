import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionCompras } from '../../componentes/navegacion-compras/navegacion-compras';
import type { Cotizacion, LineaCotizacion } from '../../modelos/compra';
import { ComprasServicio } from '../../servicios/compras-servicio';

@Component({
  selector: 'app-cotizaciones',
  imports: [CurrencyPipe, RouterLink, NavegacionCompras],
  templateUrl: './cotizaciones.html',
  styleUrls: ['./cotizaciones.css', '../../compras-compartido.css'],
})
export class Cotizaciones {
  protected readonly servicio = inject(ComprasServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly candidatas = computed(() =>
    this.servicio
      .requisiciones()
      .filter((requisicion) => !['CANCELADA', 'ATENDIDA'].includes(requisicion.estado)),
  );

  protected readonly seleccionId = signal<number>(this.inicial());
  protected readonly seleccionada = computed(() =>
    this.candidatas().find((requisicion) => requisicion.id === this.seleccionId()),
  );
  protected readonly cotizaciones = computed(() =>
    this.servicio
      .cotizaciones()
      .filter((cotizacion) => cotizacion.requisicionId === this.seleccionId()),
  );
  protected readonly columnas = computed(() =>
    this.cotizaciones().map((cotizacion) => ({
      cotizacion,
      proveedor: this.servicio.proveedorNombre(cotizacion.proveedorId),
    })),
  );
  protected readonly lineas = computed(() => this.seleccionada()?.lineas ?? []);

  protected alCambiar(evento: Event): void {
    this.seleccionId.set(Number((evento.target as HTMLSelectElement).value));
  }

  protected materialNombre(materialId: number): string {
    const material = this.servicio.obtenerMaterial(materialId);
    return material ? `${material.codigo} · ${material.nombre}` : 'Material no disponible';
  }

  protected unidad(materialId: number): string {
    return this.servicio.obtenerMaterial(materialId)?.unidadPresentacion ?? 'pieza';
  }

  protected lineaDe(cotizacion: Cotizacion, requisicionLineaId: number): LineaCotizacion | undefined {
    return cotizacion.lineas.find((linea) => linea.requisicionLineaId === requisicionLineaId);
  }

  protected generar(): void {
    const requisicion = this.seleccionada();
    if (!requisicion) {
      return;
    }
    const resultado = this.servicio.generarCotizaciones(requisicion.id);
    if (!resultado) {
      this.avisos.mostrar('error', 'No hay proveedores activos que surtan este material.');
      return;
    }
    this.avisos.mostrar(
      'exito',
      resultado.conAlterno
        ? `${resultado.cantidad} cotizaciones listas para comparar. Datos de M13, pendiente de Flask.`
        : `${resultado.cantidad} cotización disponible: no hay proveedor alterno.`,
    );
  }

  protected elegir(cotizacion: Cotizacion): void {
    const orden = this.servicio.elegirCotizacion(cotizacion.id);
    if (!orden) {
      this.avisos.mostrar('error', 'No fue posible generar la orden desde esta cotización.');
      return;
    }
    this.avisos.mostrar(
      'exito',
      `${orden.folio} se creó en BORRADOR con el precio pactado. Revisa la fecha prometida.`,
    );
    void this.router.navigate(['/compras/ordenes', orden.id, 'editar']);
  }

  private inicial(): number {
    const folio = this.ruta.snapshot.queryParamMap.get('req');
    const porFolio = folio
      ? this.servicio.requisiciones().find((requisicion) => requisicion.folio === folio)
      : undefined;
    if (porFolio) {
      return porFolio.id;
    }
    return this.servicio.requisiciones().find((requisicion) =>
      ['PENDIENTE', 'EN_COTIZACION'].includes(requisicion.estado),
    )?.id ?? 0;
  }
}
