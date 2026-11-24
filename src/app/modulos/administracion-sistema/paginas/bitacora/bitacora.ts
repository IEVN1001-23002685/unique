import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdministracionSistemaServicio } from '../../servicios/administracion-sistema-servicio';
import { fechaLegible, type FiltrosBitacora } from '../../modelos/administracion';

/** Bitácora: consulta de solo lectura de la auditoría local de M22. */
@Component({
  selector: 'app-bitacora-sistema',
  imports: [ReactiveFormsModule],
  templateUrl: './bitacora.html',
  styleUrls: ['../../estilos-compartidos.css', './bitacora.css'],
})
export class Bitacora {
  protected readonly servicio = inject(AdministracionSistemaServicio);
  private readonly fb = inject(FormBuilder);

  protected readonly formulario = this.fb.nonNullable.group({
    usuario: [''],
    entidad: [''],
    desde: [''],
    hasta: [''],
    texto: [''],
  });

  protected readonly filtros = signal<FiltrosBitacora>({
    usuario: '',
    entidad: '',
    desde: '',
    hasta: '',
    texto: '',
  });

  protected readonly entidades = computed(() =>
    Array.from(new Set(this.servicio.bitacora().map((registro) => registro.entidad))).sort(),
  );

  protected readonly visibles = computed(() => {
    const { usuario, entidad, desde, hasta, texto } = this.filtros();
    const busqueda = texto.trim().toLocaleLowerCase('es-MX');
    return this.servicio.bitacora().filter((registro) => {
      if (usuario !== '' && !registro.usuario.toLocaleLowerCase('es-MX').includes(usuario.toLocaleLowerCase('es-MX'))) {
        return false;
      }
      if (entidad !== '' && registro.entidad !== entidad) {
        return false;
      }
      if (desde !== '' && registro.fecha.slice(0, 10) < desde) {
        return false;
      }
      if (hasta !== '' && registro.fecha.slice(0, 10) > hasta) {
        return false;
      }
      if (busqueda.length > 0) {
        const campos = [registro.accion, registro.detalle, registro.entidadId ?? '', registro.ip];
        if (!campos.some((campo) => campo.toLocaleLowerCase('es-MX').includes(busqueda))) {
          return false;
        }
      }
      return true;
    });
  });

  protected readonly errorRango = signal<string | null>(null);

  protected aplicar(): void {
    const valor = this.formulario.getRawValue();
    if (valor.desde !== '' && valor.hasta !== '' && valor.desde > valor.hasta) {
      this.errorRango.set('La fecha inicial debe ser menor o igual a la fecha final.');
      return;
    }
    this.errorRango.set(null);
    this.filtros.set(valor);
  }

  protected limpiar(): void {
    this.formulario.reset({ usuario: '', entidad: '', desde: '', hasta: '', texto: '' });
    this.filtros.set({ usuario: '', entidad: '', desde: '', hasta: '', texto: '' });
    this.errorRango.set(null);
  }

  protected fecha(iso: string): string {
    return fechaLegible(iso);
  }
}
