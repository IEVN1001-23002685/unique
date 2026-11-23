import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavegacionRecetas } from '../../componentes/navegacion-recetas/navegacion-recetas';
import { IVA_PCT, MARGEN_OBJETIVO_PCT } from '../../servicios/calculos-receta';
import { RecetasServicio } from '../../servicios/recetas-servicio';

interface FilaCosteo {
  productoId: number;
  producto: string;
  talla: string;
  version: number;
  materiaPrima: number;
  hiloBordado: number;
  empaque: number;
  manoObra: number;
  bordado: number;
  indirectos: number;
  costoEstandar: number;
  precioSugerido: number;
  precioVigente: number;
  margen: number | null;
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
  protected readonly productoFiltro = signal('TODOS');

  protected readonly filas = computed<FilaCosteo[]>(() =>
    this.servicio
      .recetas()
      .filter((receta) => receta.estado === 'VIGENTE')
      .filter(
        (receta) =>
          this.productoFiltro() === 'TODOS' || String(receta.productoId) === this.productoFiltro(),
      )
      .map((receta) => {
        const costeo = this.servicio.costeo(receta);
        const precio = this.servicio.precioVigente(receta.productoId);
        return {
          productoId: receta.productoId,
          producto: this.servicio.nombreProducto(receta.productoId),
          talla: receta.talla,
          version: receta.version,
          materiaPrima: costeo.materiaPrima,
          hiloBordado: costeo.hiloBordado,
          empaque: costeo.empaque,
          manoObra: costeo.manoObra,
          bordado: costeo.bordado,
          indirectos: costeo.indirectos,
          costoEstandar: costeo.costoEstandar,
          precioSugerido: costeo.precioSugerido,
          precioVigente: precio,
          margen: this.servicio.margenDe(precio, receta),
          bordadosPendientes: this.servicio.disenosPendientes(receta).length,
        };
      })
      .sort((a, b) => a.producto.localeCompare(b.producto, 'es-MX') || a.talla.localeCompare(b.talla)),
  );

  protected readonly resumen = computed(() =>
    this.servicio.productos.map((producto) => ({
      ...producto,
      // §7.5: el precio sugerido de la prenda usa la talla de mayor costo.
      costo: this.servicio.costoEstandarDe(producto.id),
      precio: this.servicio.precioVigente(producto.id),
    })),
  );

  protected readonly margenObjetivo = MARGEN_OBJETIVO_PCT;

  protected alCambiarProducto(evento: Event): void {
    this.productoFiltro.set((evento.target as HTMLSelectElement).value);
  }

  protected precioDe(productoId: number): number {
    return this.servicio.precioVigente(productoId);
  }

  protected precioSugerido(costo: number | null): number {
    if (costo === null) {
      return 0;
    }
    return Math.round((costo / (1 - this.margenObjetivo / 100)) * (1 + IVA_PCT / 100) * 100) / 100;
  }

  protected margenTexto(margen: number | null): string {
    return margen === null ? '—' : `${margen} %`;
  }
}
