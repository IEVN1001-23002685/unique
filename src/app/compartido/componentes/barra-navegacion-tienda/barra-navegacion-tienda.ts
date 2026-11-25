import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../../core/auth/auth-state.service';
import { CarritoServicio } from '../../../modulos/carrito/servicios/carrito-servicio';
import { ModalAutenticacionServicio } from '../../../nucleo/servicios/modal-autenticacion-servicio';

@Component({
  imports: [RouterLink],
  selector: 'app-barra-navegacion-tienda',
  styleUrl: './barra-navegacion-tienda.css',
  templateUrl: './barra-navegacion-tienda.html',
})
export class BarraNavegacionTienda {
  private readonly autenticacion = inject(ModalAutenticacionServicio);
  private readonly sesion = inject(AuthStateService);
  private readonly carrito = inject(CarritoServicio);

  protected readonly menuAbierto = signal(false);
  protected readonly logoNoDisponible = signal(false);

  /** Estado de sesión canónico: la navbar no crea un estado paralelo. */
  protected readonly autenticado = this.sesion.autenticado;

  /** El badge lee el mismo resumen que la página del carrito, sin valores simulados. */
  protected readonly totalArticulos = computed(() => this.carrito.resumen().totalArticulos);

  constructor() {
    // Hidrata el contador desde la misma fuente del carrito; sin red se conserva el estado real.
    this.carrito.cargar().subscribe({ error: () => undefined });
  }

  alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  /** El breakpoint lg de Tailwind (1024 px) activa la navegación de escritorio. */
  @HostListener('window:resize')
  cerrarMenuEnEscritorio(): void {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      this.menuAbierto.set(false);
    }
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
