import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  COLORES_OFICIALES,
  PRENDAS_OFICIALES,
  TALLAS_OFICIALES,
  type PrendaOficial,
} from '../../../../nucleo/datos/catalogo-oficial';
import { PerfilDemoServicio } from '../../../../nucleo/servicios/perfil-demo-servicio';
import { NavegacionProductos } from '../../componentes/navegacion-productos/navegacion-productos';

/** Sección «Nuevas»: explora prendas y variables nuevas antes de crear un producto. */
@Component({
  selector: 'app-nuevas',
  imports: [DecimalPipe, NavegacionProductos],
  templateUrl: './nuevas.html',
  styleUrl: './nuevas.css',
})
export class Nuevas {
  private readonly router = inject(Router);
  protected readonly perfilDemo = inject(PerfilDemoServicio);

  protected readonly prendas = PRENDAS_OFICIALES;
  protected readonly colores = COLORES_OFICIALES;
  protected readonly tallas = TALLAS_OFICIALES;
  protected readonly fallidos = signal<ReadonlySet<string>>(new Set<string>());

  protected nombreColor(codigo: string): string {
    return this.colores.find((color) => color.codigo === codigo)?.nombre ?? codigo;
  }

  protected nombreTalla(codigo: string): string {
    return this.tallas.find((talla) => talla.codigo === codigo)?.nombre ?? codigo;
  }

  protected imagenVisible(clave: string, url: string): boolean {
    return url !== '' && !this.fallidos().has(clave);
  }

  protected marcarFallido(clave: string): void {
    const siguiente = new Set(this.fallidos());
    siguiente.add(clave);
    this.fallidos.set(siguiente);
  }

  /** Lleva la selección al formulario, que precarga los valores oficiales de la prenda. */
  protected elegir(prenda: PrendaOficial): void {
    void this.router.navigate(['/admin/productos/nuevo'], {
      queryParams: { prenda: prenda.slug },
    });
  }
}
