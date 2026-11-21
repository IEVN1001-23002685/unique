import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BusquedaCatalogoServicio } from '../../../nucleo/servicios/busqueda-catalogo-servicio';
import { ModalAutenticacionServicio } from '../../../nucleo/servicios/modal-autenticacion-servicio';

@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-barra-navegacion-tienda',
  styleUrl: './barra-navegacion-tienda.css',
  templateUrl: './barra-navegacion-tienda.html',
})
export class BarraNavegacionTienda {
  protected readonly menuAbierto = signal(false);
  protected readonly logoNoDisponible = signal(false);
  protected readonly busqueda = inject(BusquedaCatalogoServicio);
  private readonly autenticacion = inject(ModalAutenticacionServicio);

  actualizarTermino(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.busqueda.termino.set(entrada.value);
  }

  alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  abrirRegistro(): void {
    this.cerrarMenu();
    this.autenticacion.abrirRegistro();
  }

  abrirInicioSesion(): void {
    this.cerrarMenu();
    this.autenticacion.abrirLogin();
  }
}
