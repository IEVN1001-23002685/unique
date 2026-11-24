import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdministracionSistemaServicio } from '../../servicios/administracion-sistema-servicio';
import { fechaLegible, mxn, type ClienteSistema } from '../../modelos/administracion';

/**
 * Clientes: solo lectura de compras. El historial se consulta a M08 y el saldo
 * es un valor simulado; M07 no existe todavía en el frontend.
 */
@Component({
  selector: 'app-clientes-sistema',
  imports: [FormsModule],
  templateUrl: './clientes.html',
  styleUrls: ['../../estilos-compartidos.css', './clientes.css'],
})
export class Clientes {
  protected readonly servicio = inject(AdministracionSistemaServicio);
  protected readonly busqueda = signal('');
  protected readonly seleccionado = signal<number | null>(null);

  protected readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase('es-MX');
    if (texto.length === 0) {
      return this.servicio.clientes();
    }
    return this.servicio.clientes().filter((cliente) =>
      [cliente.nombre, cliente.correo, cliente.telefono].some((campo) =>
        campo.toLocaleLowerCase('es-MX').includes(texto),
      ),
    );
  });

  protected readonly detalle = computed<ClienteSistema | null>(() => {
    const id = this.seleccionado();
    return id === null
      ? null
      : (this.servicio.clientes().find((cliente) => cliente.id === id) ?? null);
  });

  protected readonly totalPendiente = computed(() =>
    this.servicio.clientes().reduce((suma, cliente) => suma + cliente.pagosPendientes, 0),
  );

  protected formatoMXN(valor: number): string {
    return mxn(valor);
  }

  protected fecha(iso: string): string {
    return fechaLegible(iso);
  }

  protected alternarDetalle(id: number): void {
    this.seleccionado.update((actual) => (actual === id ? null : id));
  }
}
