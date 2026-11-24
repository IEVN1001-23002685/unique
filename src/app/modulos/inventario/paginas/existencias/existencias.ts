import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavegacionInventario } from '../../componentes/navegacion-inventario/navegacion-inventario';
import { SemaforoInventario } from '../../componentes/semaforo-inventario/semaforo-inventario';
import { CATEGORIAS, type CategoriaMaterial, type ExistenciaVista } from '../../modelos/inventario';
import { InventarioServicio, redondear4 } from '../../servicios/inventario-servicio';

type FiltroCategoria = CategoriaMaterial | 'Todas';

@Component({
  selector: 'app-existencias',
  imports: [DecimalPipe, RouterLink, NavegacionInventario, SemaforoInventario],
  templateUrl: './existencias.html',
  styleUrls: ['./existencias.css', '../../inventario-compartido.css'],
})
export class Existencias {
  protected readonly servicio = inject(InventarioServicio);
  protected readonly categorias: FiltroCategoria[] = ['Todas', ...CATEGORIAS];

  protected readonly categoria = signal<FiltroCategoria>('Todas');
  protected readonly busqueda = signal('');
  protected readonly solicitud = signal<ExistenciaVista | null>(null);

  protected readonly filtradas = computed(() => {
    const categoria = this.categoria();
    const texto = this.busqueda().trim().toLocaleLowerCase('es-MX');
    return this.servicio.vistas().filter((vista) => {
      if (!vista.material.activo) {
        return false;
      }
      if (categoria !== 'Todas' && vista.material.categoria !== categoria) {
        return false;
      }
      if (texto === '') {
        return true;
      }
      return [vista.material.codigo, vista.material.nombre, vista.color]
        .join(' ')
        .toLocaleLowerCase('es-MX')
        .includes(texto);
    });
  });

  protected readonly totales = computed(() => {
    const vistas = this.filtradas();
    return {
      rojo: vistas.filter((vista) => vista.semaforo === 'ROJO').length,
      ambar: vistas.filter((vista) => vista.semaforo === 'AMBAR').length,
      verde: vistas.filter((vista) => vista.semaforo === 'VERDE').length,
      atencion: vistas.filter((vista) => vista.requiereAtencion).length,
    };
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected abrirSolicitud(vista: ExistenciaVista): void {
    this.solicitud.set(vista);
  }

  protected faltanteSugerido(vista: ExistenciaVista): number {
    return redondear4(Math.max(0, vista.puntoReorden - vista.posicion));
  }

  protected etiquetaSemaforo(vista: ExistenciaVista): string {
    return { ROJO: 'Rojo', AMBAR: 'Ámbar', VERDE: 'Verde' }[vista.semaforo];
  }
}
