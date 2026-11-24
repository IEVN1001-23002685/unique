import { Component, computed, input } from '@angular/core';
import {
  ETIQUETAS_ESTADO_USUARIO,
  ETIQUETAS_ROL,
  type EstadoCuentaUsuario,
  type RolUsuarioSistema,
} from '../../modelos/administracion';

/** Chip reutilizable de rol o estado con círculo de color más etiqueta textual. */
@Component({
  selector: 'app-chip-usuario',
  templateUrl: './chip-usuario.html',
  styleUrl: './chip-usuario.css',
})
export class ChipUsuario {
  readonly rol = input<RolUsuarioSistema | null>(null);
  readonly estado = input<EstadoCuentaUsuario | null>(null);

  protected readonly etiqueta = computed(() => {
    if (this.rol() !== null) {
      return ETIQUETAS_ROL[this.rol()!];
    }
    const estado = this.estado();
    return estado === null ? '' : ETIQUETAS_ESTADO_USUARIO[estado];
  });

  protected readonly clase = computed(() => {
    const valor = this.rol() ?? this.estado();
    return `chip chip--${valor === null ? 'inactiva' : valor.toLocaleLowerCase('es-MX')}`;
  });
}
