import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavegacionInventarioPt } from '../../componentes/navegacion-inventario-pt/navegacion-inventario-pt';
import { SemaforoInventario } from '../../componentes/semaforo-inventario/semaforo-inventario';
import type { FilaExistencia } from '../../modelos/inventario-producto-terminado';
import { InventarioProductoServicio } from '../../servicios/inventario-producto-terminado-servicio';

type FiltroCategoria = number | 'TODAS';

@Component({
  selector: 'app-existencias-inventario-pt',
  imports: [DatePipe, RouterLink, NavegacionInventarioPt, SemaforoInventario],
  templateUrl: './existencias.html',
  styleUrls: ['./existencias.css', '../../estilos-compartidos.css'],
})
export class Existencias {
  protected readonly servicio = inject(InventarioProductoServicio);
  protected readonly categorias = this.servicio.categorias;
  protected readonly categoriaActiva = signal<FiltroCategoria>('TODAS');
  protected readonly busqueda = signal('');

  protected readonly filas = this.servicio.existencias;
  protected readonly indicadores = this.servicio.indicadores;
  /** Vista derivada de stock real: no fabrica alertas ni consecutivos locales. */
  protected readonly reposicion = computed(() =>
    this.servicio.existencias().filter((fila) => fila.semaforo !== 'VERDE').slice(0, 3),
  );
  protected readonly ajustesRecientes = computed(() =>
    this.servicio.movimientos().filter((movimiento) => movimiento.tipo === 'AJUSTE').slice(0, 3),
  );

  protected readonly filtradas = computed<FilaExistencia[]>(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const categoria = this.categoriaActiva();

    return this.filas().filter((fila) => {
      const coincideCategoria = categoria === 'TODAS' || fila.categoriaId === categoria;
      const texto = [fila.sku, fila.productoNombre, fila.talla, fila.color, fila.categoriaNombre]
        .join(' ')
        .toLowerCase();
      return coincideCategoria && texto.includes(termino);
    });
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected seleccionarCategoria(categoria: FiltroCategoria): void {
    this.categoriaActiva.set(categoria);
  }

  protected cobertura(fila: FilaExistencia): string {
    return fila.diasCobertura === null ? '—' : fila.diasCobertura.toFixed(1);
  }

  protected reintentar(): void {
    this.servicio.recargar().subscribe();
  }
}
