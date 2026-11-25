import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SelectorPerfilDemo } from '../../../../compartido/componentes/selector-perfil-demo/selector-perfil-demo';
import { PerfilDemoServicio } from '../../../../nucleo/servicios/perfil-demo-servicio';
import { NavegacionInventario } from '../../componentes/navegacion-inventario/navegacion-inventario';
import { InventarioServicio } from '../../servicios/inventario-servicio';

@Component({
  selector: 'app-lotes',
  imports: [CurrencyPipe, DecimalPipe, RouterLink, NavegacionInventario, SelectorPerfilDemo],
  templateUrl: './lotes.html',
  styleUrls: ['./lotes.css', '../../inventario-compartido.css'],
})
export class Lotes {
  protected readonly servicio = inject(InventarioServicio);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly perfilDemo = inject(PerfilDemoServicio);
  protected readonly esAdministrador = this.perfilDemo.esAdministrador;

  protected readonly materiales = computed(() =>
    this.servicio.materiales().filter((material) => material.activo),
  );

  protected readonly materialId = signal(this.materialInicial());
  protected readonly color = signal(this.ruta.snapshot.queryParamMap.get('color') ?? '');
  protected readonly busqueda = signal('');

  protected readonly colores = computed(() => this.servicio.coloresDe(this.materialId()));

  protected readonly filtrados = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase('es-MX');
    return this.servicio.lotesOrdenados().filter((lote) => {
      if (this.materialId() > 0 && lote.materialId !== this.materialId()) {
        return false;
      }
      if (this.color() !== '' && lote.color !== this.color()) {
        return false;
      }
      if (texto !== '' && !lote.folio.toLocaleLowerCase('es-MX').includes(texto)) {
        return false;
      }
      return true;
    });
  });

  protected alCambiarMaterial(evento: Event): void {
    this.materialId.set(Number((evento.target as HTMLSelectElement).value));
    this.color.set('');
  }

  protected alCambiarColor(evento: Event): void {
    this.color.set((evento.target as HTMLSelectElement).value);
  }

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected limpiar(): void {
    this.materialId.set(0);
    this.color.set('');
    this.busqueda.set('');
  }

  private materialInicial(): number {
    const parametro = Number(this.ruta.snapshot.queryParamMap.get('material'));
    return Number.isInteger(parametro) && parametro > 0 ? parametro : 0;
  }
}
