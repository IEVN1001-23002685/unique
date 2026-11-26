import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { Router, RouterLink } from '@angular/router';
import { AvisoToast } from '../../compartido/componentes/aviso-toast/aviso-toast';
import { ModalConfirmacion } from '../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { esCantidadEnteraValida } from '../../compartido/validadores/validadores-negocio';
import { mensajeError } from '../../core/api/errores';
import { AuthStateService } from '../../core/auth/auth-state.service';
import { AvisosServicio } from '../../nucleo/servicios/avisos-servicio';
import { ModalAutenticacionServicio } from '../../nucleo/servicios/modal-autenticacion-servicio';
import { CarritoServicio } from './servicios/carrito-servicio';
import type { EstadoLineaCarrito, ItemCarrito } from './modelos/carrito';

export type { EstadoLineaCarrito, ItemCarrito, ResumenCarrito } from './modelos/carrito';

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [AvisoToast, CurrencyPipe, RouterLink, ModalConfirmacion],
  templateUrl: './carrito.html',
  styleUrl: './carrito.css',
})
export class Carrito {
  private readonly router = inject(Router);
  private readonly carrito = inject(CarritoServicio);
  private readonly sesion = inject(AuthStateService);
  private readonly avisos = inject(AvisosServicio);
  private readonly autenticacion = inject(ModalAutenticacionServicio);

  protected readonly items = this.carrito.items;
  protected readonly resumen = this.carrito.resumen;
  protected readonly autenticado = this.sesion.autenticado;

  protected readonly cargando = signal(true);
  protected readonly error = signal('');
  protected readonly mensaje = signal('');
  protected readonly operando = signal<number | null>(null);
  protected readonly eliminando = signal(false);
  protected readonly lineaPorEliminar = signal<ItemCarrito | null>(null);
  protected readonly imagenesFallidas = signal<number[]>([]);

  protected readonly maximo = computed(() => this.resumen().maxPiezasPorLinea);
  protected readonly esInvitado = computed(() => this.resumen().origen === 'navegador');

  protected readonly lineasInvalidas = computed(() =>
    this.items().filter(
      (item) =>
        item.estadoDisponibilidad === 'Agotado' ||
        !!item.cambioDetectado ||
        !esCantidadEnteraValida(item.cantidad, this.maximo()),
    ),
  );

  protected readonly puedePagar = computed(
    () =>
      !this.cargando() &&
      !this.error() &&
      this.items().length > 0 &&
      this.lineasInvalidas().length === 0 &&
      this.resumen().puedePagar,
  );

  protected readonly aviso = computed(() => {
    if (this.esInvitado()) {
      return 'Carrito de invitado: se guarda solo en este navegador. Al pagar debes iniciar sesión para fusionarlo; entonces se revalidarán precios y disponibilidad. No se reservó existencia.';
    }
    if (!this.autenticado()) {
      return 'Inicia sesión al pagar para conservar tu carrito en tu cuenta.';
    }
    return '';
  });

  constructor() {
    this.carrito.cargar().subscribe({
      next: () => this.cargando.set(false),
      error: (error: unknown) => {
        this.cargando.set(false);
        this.error.set(mensajeError(error, 'No fue posible cargar tu carrito.'));
      },
    });
  }

  protected reintentar(): void {
    this.error.set('');
    this.cargando.set(true);
    this.carrito.cargar().subscribe({
      next: () => this.cargando.set(false),
      error: (error: unknown) => {
        this.cargando.set(false);
        this.error.set(mensajeError(error, 'No fue posible cargar tu carrito.'));
      },
    });
  }

  protected cambiarCantidad(item: ItemCarrito, delta: number): void {
    if (this.operando() !== null) return;

    const siguiente = item.cantidad + delta;
    if (!esCantidadEnteraValida(siguiente, this.maximo())) {
      this.mensaje.set(
        delta > 0
          ? `Máximo ${this.maximo()} unidades por línea.`
          : 'Para quitar la prenda usa el botón «Quitar».',
      );
      return;
    }

    this.mensaje.set('');
    this.operando.set(item.varianteId);
    this.carrito
      .cambiarCantidad(item.varianteId, siguiente)
      .pipe(finalize(() => this.operando.set(null)))
      .subscribe({
        next: () => undefined,
        error: (error: unknown) => {
          this.mensaje.set(mensajeError(error, 'No fue posible actualizar la cantidad.'));
          this.avisos.mostrar('error', 'No se pudo actualizar la cantidad del carrito.');
        },
      });
  }

  protected pedirEliminacion(item: ItemCarrito): void {
    this.mensaje.set('');
    this.lineaPorEliminar.set(item);
  }

  protected cancelarEliminacion(): void {
    if (this.eliminando()) return;
    this.lineaPorEliminar.set(null);
  }

  protected confirmarEliminacion(): void {
    const linea = this.lineaPorEliminar();
    if (!linea || this.eliminando()) return;

    this.eliminando.set(true);
    this.carrito
      .eliminar(linea.varianteId)
      .pipe(
        finalize(() => {
          this.eliminando.set(false);
          this.lineaPorEliminar.set(null);
        }),
      )
      .subscribe({
        next: () => {
          this.mensaje.set(`Se quitó «${linea.nombre}» del carrito.`);
          this.avisos.mostrar('exito', 'Producto eliminado del carrito.');
        },
        error: (error: unknown) => {
          this.mensaje.set(mensajeError(error, 'No fue posible eliminar la línea.'));
          this.avisos.mostrar('error', 'No se pudo eliminar la línea del carrito.');
        },
      });
  }

  protected irAPagar(): void {
    if (!this.autenticado()) {
      this.mensaje.set('Inicia sesión para continuar; tu carrito se fusionará con tu cuenta.');
      this.autenticacion.abrirLogin();
      return;
    }
    if (!this.puedePagar()) {
      this.mensaje.set(
        this.lineasInvalidas().length > 0
          ? 'Hay líneas que no se pueden pagar. Revisa tu carrito antes de continuar.'
          : 'Tu carrito está vacío.',
      );
      return;
    }
    this.mensaje.set('');
    void this.router.navigate(['/pago']);
  }

  protected imagenValida(item: ItemCarrito): boolean {
    return !!item.imagenUrl && !this.imagenesFallidas().includes(item.varianteId);
  }

  protected marcarImagenFallida(item: ItemCarrito): void {
    this.imagenesFallidas.update((lista) =>
      lista.includes(item.varianteId) ? lista : [...lista, item.varianteId],
    );
  }

  protected claseEstado(estado: EstadoLineaCarrito): string {
    if (estado === 'Disponible') return 'disponible';
    if (estado === 'Pocas unidades') return 'pocas';
    if (estado === 'Bajo pedido') return 'pedido';
    return 'agotado';
  }

  protected fechaEstimada(item: ItemCarrito): string {
    if (!item.fechaEstimada) return '';
    const fecha = new Date(item.fechaEstimada);
    if (Number.isNaN(fecha.getTime())) return item.fechaEstimada;
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(fecha);
  }
}
