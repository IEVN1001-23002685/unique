import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ModalConfirmacion } from '../../../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { ModalRepartidor } from '../../componentes/modal-repartidor/modal-repartidor';
import { NavegacionEntregas } from '../../componentes/navegacion-entregas/navegacion-entregas';
import type { DatosRepartidor, Repartidor } from '../../modelos/entrega';
import { EntregasServicio } from '../../servicios/entregas-servicio';

@Component({
  selector: 'app-repartidores',
  imports: [RouterLink, ModalConfirmacion, ModalRepartidor, NavegacionEntregas],
  templateUrl: './repartidores.html',
  styleUrls: ['../../estilos-compartidos.css', './repartidores.css'],
})
export class Repartidores {
  protected readonly servicio = inject(EntregasServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly busqueda = signal('');
  protected readonly creando = signal(false);
  protected readonly editando = signal<Repartidor | null>(null);
  protected readonly eliminando = signal<Repartidor | null>(null);

  protected readonly activos = computed(
    () => this.servicio.repartidores().filter((item) => item.activo).length,
  );

  protected readonly filtrados = computed<Repartidor[]>(() => {
    const termino = this.busqueda().trim().toLowerCase();
    return this.servicio
      .repartidores()
      .filter(
        (item) =>
          termino === '' ||
          item.nombre.toLowerCase().includes(termino) ||
          item.telefono.includes(termino) ||
          (item.vehiculo ?? '').toLowerCase().includes(termino),
      );
  });

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected abrirAlta(): void {
    this.editando.set(null);
    this.creando.set(true);
  }

  protected abrirEdicion(repartidor: Repartidor): void {
    this.creando.set(false);
    this.editando.set(repartidor);
  }

  protected cerrarFormulario(): void {
    this.creando.set(false);
    this.editando.set(null);
  }

  protected guardar(datos: DatosRepartidor): void {
    const actual = this.editando();
    const resultado = actual
      ? this.servicio.editarRepartidor(actual.id, datos)
      : this.servicio.altaRepartidor(datos);

    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok) {
      this.cerrarFormulario();
    }
  }

  protected confirmarEliminar(): void {
    const actual = this.eliminando();
    if (!actual) {
      return;
    }
    const resultado = this.servicio.eliminarRepartidor(actual.id);
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
    if (resultado.ok) {
      this.eliminando.set(null);
    }
  }

  protected entregasDe(id: number): number {
    return this.servicio.entregas().filter((entrega) => entrega.repartidorId === id).length;
  }

  protected mensajeBaja(repartidor: Repartidor): string {
    const entregas = this.entregasDe(repartidor.id);
    return entregas > 0
      ? `${repartidor.nombre} tiene ${entregas} entregas registradas. Se desactivará y conservará su historial.`
      : `${repartidor.nombre} no tiene entregas registradas. Se dará de baja en la demostración.`;
  }
}
