import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SelectorPerfilDemo } from '../../../../compartido/componentes/selector-perfil-demo/selector-perfil-demo';
import { PerfilDemoServicio } from '../../../../nucleo/servicios/perfil-demo-servicio';
import { NavegacionInventario } from '../../componentes/navegacion-inventario/navegacion-inventario';
import { type FiltrosKardex, type TipoMovimiento } from '../../modelos/inventario';
import { InventarioServicio } from '../../servicios/inventario-servicio';

const TIPOS: (TipoMovimiento | 'TODOS')[] = [
  'TODOS',
  'ENTRADA',
  'CONSUMO',
  'MERMA',
  'AJUSTE',
  'SOBRANTE',
  'REVERSA',
];

@Component({
  selector: 'app-kardex',
  imports: [CurrencyPipe, DecimalPipe, RouterLink, NavegacionInventario, SelectorPerfilDemo],
  templateUrl: './kardex.html',
  styleUrls: ['./kardex.css', '../../inventario-compartido.css'],
})
export class Kardex {
  protected readonly servicio = inject(InventarioServicio);
  private readonly ruta = inject(ActivatedRoute);
  protected readonly perfilDemo = inject(PerfilDemoServicio);
  protected readonly esAdministrador = this.perfilDemo.esAdministrador;

  protected readonly tipos = TIPOS;
  protected readonly materiales = computed(() =>
    this.servicio.materiales().filter((material) => material.activo),
  );

  protected readonly materialId = signal(this.numeroInicial('material'));
  protected readonly color = signal(this.ruta.snapshot.queryParamMap.get('color') ?? '');
  protected readonly loteFolio = signal(this.ruta.snapshot.queryParamMap.get('lote') ?? '');
  protected readonly tipo = signal<TipoMovimiento | 'TODOS'>('TODOS');
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  protected readonly colores = computed(() => this.servicio.coloresDe(this.materialId()));

  protected readonly lotes = computed(() =>
    this.servicio.lotesOrdenados().filter((lote) => {
      if (this.materialId() > 0 && lote.materialId !== this.materialId()) {
        return false;
      }
      return this.color() === '' || lote.color === this.color();
    }),
  );

  private readonly filtros = computed<FiltrosKardex>(() => ({
    materialId: this.materialId(),
    color: this.color(),
    loteFolio: this.loteFolio(),
    tipo: this.tipo(),
    desde: this.desde(),
    hasta: this.hasta(),
  }));

  protected readonly movimientos = computed(() =>
    this.servicio.movimientosFiltrados(this.filtros()),
  );

  protected readonly totales = computed(() => {
    const lista = this.movimientos();
    return {
      movimientos: lista.length,
      entradas: lista.filter((movimiento) => movimiento.cantidadBase > 0).length,
      salidas: lista.filter((movimiento) => movimiento.cantidadBase < 0).length,
    };
  });

  protected alCambiarMaterial(evento: Event): void {
    this.materialId.set(Number((evento.target as HTMLSelectElement).value));
    this.color.set('');
    this.loteFolio.set('');
  }

  protected alCambiarColor(evento: Event): void {
    this.color.set((evento.target as HTMLSelectElement).value);
    this.loteFolio.set('');
  }

  protected alCambiarLote(evento: Event): void {
    this.loteFolio.set((evento.target as HTMLSelectElement).value);
  }

  protected alCambiarTipo(evento: Event): void {
    this.tipo.set((evento.target as HTMLSelectElement).value as TipoMovimiento | 'TODOS');
  }

  protected alCambiarDesde(evento: Event): void {
    this.desde.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarHasta(evento: Event): void {
    this.hasta.set((evento.target as HTMLInputElement).value);
  }

  protected limpiar(): void {
    this.materialId.set(0);
    this.color.set('');
    this.loteFolio.set('');
    this.tipo.set('TODOS');
    this.desde.set('');
    this.hasta.set('');
  }

  protected etiquetaTipo(tipo: TipoMovimiento | 'TODOS'): string {
    if (tipo === 'TODOS') {
      return 'Todos los tipos';
    }
    return {
      ENTRADA: 'Entrada',
      CONSUMO: 'Consumo',
      MERMA: 'Merma',
      AJUSTE: 'Ajuste',
      SOBRANTE: 'Sobrante',
      REVERSA: 'Reversa',
    }[tipo];
  }

  private numeroInicial(clave: string): number {
    const valor = Number(this.ruta.snapshot.queryParamMap.get(clave));
    return Number.isInteger(valor) && valor > 0 ? valor : 0;
  }
}
