import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { PerfilDemoServicio } from '../../../../nucleo/servicios/perfil-demo-servicio';
import { NavegacionProductos } from '../../componentes/navegacion-productos/navegacion-productos';
import type { ProductoMaestro } from '../../modelos/producto-maestro';
import { ProductosServicio } from '../../servicios/productos-servicio';

type EstatusProducto = 'ACTIVO' | 'BORRADOR' | 'DESACTIVADO';
type FiltroEstatus = 'TODOS' | EstatusProducto;

@Component({
  selector: 'app-catalogo-maestro',
  imports: [CurrencyPipe, RouterLink, ModalConfirmacion, NavegacionProductos],
  templateUrl: './catalogo-maestro.html',
  styleUrl: './catalogo-maestro.css',
})
export class CatalogoMaestro {
  protected readonly servicio = inject(ProductosServicio);
  protected readonly perfilDemo = inject(PerfilDemoServicio);
  private readonly avisos = inject(AvisosServicio);
  private readonly router = inject(Router);

  protected readonly busqueda = signal('');
  protected readonly categoria = signal('TODAS');
  protected readonly estatus = signal<FiltroEstatus>('TODOS');
  protected readonly confirmando = signal<ProductoMaestro | null>(null);

  protected readonly productos = this.servicio.productos;
  protected readonly indicadores = this.servicio.indicadores;

  constructor() {
    this.servicio.recargar().subscribe();
  }

  protected readonly filtrados = computed(() => {
    const termino = this.busqueda().trim().toLowerCase();
    const categoria = this.categoria();
    const estatus = this.estatus();

    return this.productos().filter((producto) => {
      const coincide =
        termino === '' ||
        [
          producto.nombre,
          producto.codigoSku,
          producto.descripcion,
          this.servicio.nombreCategoria(producto.categoriaId),
          ...producto.variantes.map((variante) => variante.sku),
        ].some((valor) => valor.toLowerCase().includes(termino));

      const categoriaOk = categoria === 'TODAS' || String(producto.categoriaId) === categoria;
      return (
        coincide && categoriaOk && (estatus === 'TODOS' || this.estatusDe(producto) === estatus)
      );
    });
  });

  protected estatusDe(producto: ProductoMaestro): EstatusProducto {
    if (producto.eliminadoEn !== null) {
      return 'DESACTIVADO';
    }
    return producto.activo ? 'ACTIVO' : 'BORRADOR';
  }

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarCategoria(evento: Event): void {
    this.categoria.set((evento.target as HTMLSelectElement).value);
  }

  protected alCambiarEstatus(evento: Event): void {
    this.estatus.set((evento.target as HTMLSelectElement).value as FiltroEstatus);
  }

  protected margen(producto: ProductoMaestro): number | null {
    return this.servicio.margenReal(producto.precioVenta, producto.costoEstandar);
  }

  protected textoMargen(producto: ProductoMaestro): string {
    const valor = this.margen(producto);
    return valor === null ? '—' : `${valor}%`;
  }

  protected margenBajo(producto: ProductoMaestro): boolean {
    const valor = this.margen(producto);
    return valor !== null && valor < 50;
  }

  protected verVariantes(producto: ProductoMaestro): void {
    void this.router.navigate(['/admin/productos/variantes'], {
      queryParams: { producto: producto.id },
    });
  }

  protected activar(producto: ProductoMaestro, activar: boolean): void {
    this.servicio.cambiarActivo(producto.id, activar).subscribe({
      next: (resultado) =>
        this.avisos.mostrar(resultado.ok ? 'exito' : 'advertencia', resultado.mensaje),
      error: () => this.avisos.mostrar('error', 'No fue posible cambiar el estado en Flask.'),
    });
  }

  protected pedirEliminacion(producto: ProductoMaestro): void {
    this.confirmando.set(producto);
  }

  protected mensajeEliminacion(producto: ProductoMaestro): string {
    return producto.tieneHistorial
      ? 'El producto tiene ventas o movimientos. Se desactivará con borrado lógico (eliminado_en) y se conservará su historial.'
      : 'El producto no tiene ventas ni movimientos. Flask podrá eliminarlo físicamente.';
  }

  protected confirmarEliminacion(): void {
    const producto = this.confirmando();
    if (!producto) {
      return;
    }
    this.servicio.eliminarProducto(producto.id).subscribe({
      next: (resultado) => {
        this.avisos.mostrar(resultado.ok ? 'advertencia' : 'error', resultado.mensaje);
        this.confirmando.set(null);
      },
      error: () => {
        this.avisos.mostrar('error', 'No fue posible dar de baja el producto en Flask.');
        this.confirmando.set(null);
      },
    });
  }
}
