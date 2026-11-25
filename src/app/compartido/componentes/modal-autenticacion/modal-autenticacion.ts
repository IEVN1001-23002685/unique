import { Component, HostListener, inject } from '@angular/core';
import { InicioSesion } from '../../../modulos/acceso-registro/paginas/inicio-sesion/inicio-sesion';
import type { CredencialesLogin } from '../../../modulos/acceso-registro/modelos/acceso-registro';
import { Registro } from '../../../modulos/acceso-registro/paginas/registro/registro';
import { ModalAutenticacionServicio } from '../../../nucleo/servicios/modal-autenticacion-servicio';

@Component({
  imports: [InicioSesion, Registro],
  selector: 'app-modal-autenticacion',
  styleUrl: './modal-autenticacion.css',
  templateUrl: './modal-autenticacion.html',
})
export class ModalAutenticacion {
  protected readonly modal = inject(ModalAutenticacionServicio);

  /** Demostracion visual: no se crea sesion ni se envia nada a un backend. */
  protected alEnviarLogin(credenciales: CredencialesLogin): void {
    console.info('Demostracion visual: credenciales listas para la futura API.', credenciales);
  }

  protected cerrarSiEsBackdrop(evento: MouseEvent): void {
    if (evento.target === evento.currentTarget) {
      this.modal.cerrar();
    }
  }

  @HostListener('document:keydown.escape')
  protected cerrarConEscape(): void {
    if (this.modal.modalActiva() !== null) {
      this.modal.cerrar();
    }
  }
}
