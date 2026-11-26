import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionRecetas } from '../../componentes/navegacion-recetas/navegacion-recetas';
import type { CodigoTalla } from '../../../productos/modelos/producto-maestro';
import { RecetasServicio } from '../../servicios/recetas-servicio';

@Component({
  selector: 'app-historial-recetas',
  imports: [DatePipe, RouterLink, NavegacionRecetas],
  templateUrl: './historial-recetas.html',
  styleUrl: './historial-recetas.css',
})
export class HistorialRecetas {
  protected readonly servicio = inject(RecetasServicio);
  private readonly ruta = inject(ActivatedRoute);
  private readonly avisos = inject(AvisosServicio);

  protected readonly producto = signal(
    Number(this.ruta.snapshot.queryParamMap.get('producto') ?? 1),
  );
  protected readonly talla = signal<CodigoTalla>(
    (this.ruta.snapshot.queryParamMap.get('talla') as CodigoTalla | null) ?? 'CH',
  );

  protected readonly versiones = computed(() =>
    this.servicio.recetasDeProducto(this.producto(), this.talla()),
  );

  protected readonly idA = signal<number | null>(null);
  protected readonly idB = signal<number | null>(null);

  protected readonly comparacion = computed(() => {
    const a = this.idA();
    const b = this.idB();
    return a !== null && b !== null ? this.servicio.comparar(a, b) : [];
  });

  protected readonly productos = computed(() => this.servicio.productos());

  constructor() {
    this.servicio.recargar().subscribe({
      next: () => this.seleccionarUltimas(),
      error: () => this.avisos.mostrar('error', 'No fue posible cargar el historial desde Flask.'),
    });
  }

  protected reintentar(): void {
    this.servicio.recargar().subscribe({ next: () => this.seleccionarUltimas() });
  }

  protected alCambiarProducto(evento: Event): void {
    const id = Number((evento.target as HTMLSelectElement).value);
    this.producto.set(id);
    const tallas = this.servicio.tallasDeProducto(id);
    if (!tallas.includes(this.talla())) {
      this.talla.set(tallas[0] ?? 'UN');
    }
    this.seleccionarUltimas();
  }

  protected alCambiarTalla(evento: Event): void {
    this.talla.set((evento.target as HTMLSelectElement).value as CodigoTalla);
    this.seleccionarUltimas();
  }

  private seleccionarUltimas(): void {
    const lista = this.versiones();
    this.idA.set(lista[0]?.id ?? null);
    this.idB.set(lista[1]?.id ?? lista[0]?.id ?? null);
  }

  protected seleccionar(cual: 'A' | 'B', id: number): void {
    if (cual === 'A') {
      this.idA.set(id);
    } else {
      this.idB.set(id);
    }
  }

  protected etiquetaVersion(id: number | null): string {
    const receta = id === null ? undefined : this.servicio.recetaDe(id);
    return receta ? `v${receta.version} · ${receta.estado}` : '—';
  }
}
