import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionRecetas } from '../../componentes/navegacion-recetas/navegacion-recetas';
import { MARGEN_OBJETIVO_PCT } from '../../servicios/calculos-receta';
import type { FilaCosteo } from '../../servicios/recetas-servicio';
import { RecetasServicio } from '../../servicios/recetas-servicio';

interface FilaCosteoVista extends FilaCosteo {
  version: number;
  bordadosPendientes: number;
}

@Component({
  selector: 'app-costeo-estandar',
  imports: [CurrencyPipe, RouterLink, NavegacionRecetas],
  templateUrl: './costeo-estandar.html',
  styleUrl: './costeo-estandar.css',
})
export class CosteoEstandar {
  protected readonly servicio = inject(RecetasServicio);
  private readonly avisos = inject(AvisosServicio);
  protected readonly productoFiltro = signal('TODOS');

  protected readonly filas = computed<FilaCosteoVista[]>(() =>
    this.servicio
      .costeoFilas()
      .filter(
        (fila) =>
          this.productoFiltro() === 'TODOS' || String(fila.productoId) === this.productoFiltro(),
      )
      .map((fila) => {
        const receta = this.servicio.recetaDe(fila.recetaId);
        return {
          ...fila,
          version: receta?.version ?? 0,
          bordadosPendientes: receta ? this.servicio.disenosPendientes(receta).length : 0,
        };
      })
      .filter((fila) => fila.version > 0)
      .sort(
        (a, b) => a.producto.localeCompare(b.producto, 'es-MX') || a.talla.localeCompare(b.talla),
      ),
  );

  protected readonly resumen = computed(() => {
    const mayores = new Map<number, FilaCosteo>();
    for (const fila of this.servicio.costeoFilas()) {
      const actual = mayores.get(fila.productoId);
      if (!actual || fila.costoEstandar > actual.costoEstandar) {
        mayores.set(fila.productoId, fila);
      }
    }
    return this.servicio.productos().map((producto) => {
      const mayor = mayores.get(producto.id);
      return {
        id: producto.id,
        nombre: producto.nombre,
        costo: mayor?.costoEstandar ?? null,
        precioSugerido: mayor?.precioSugerido ?? null,
        precio: this.servicio.precioVigente(producto.id),
      };
    });
  });

  protected readonly margenObjetivo = MARGEN_OBJETIVO_PCT;
  protected readonly margenObjetivoFraccion = MARGEN_OBJETIVO_PCT / 100;

  constructor() {
    this.servicio.recargar().subscribe({
      error: () => this.avisos.mostrar('error', 'No fue posible cargar el costeo desde Flask.'),
    });
  }

  protected alCambiarProducto(evento: Event): void {
    this.productoFiltro.set((evento.target as HTMLSelectElement).value);
  }

  protected precioDe(productoId: number): number {
    return this.servicio.precioVigente(productoId);
  }

  protected margenTexto(margen: number): string {
    return `${(margen * 100).toFixed(1)} %`;
  }
}
