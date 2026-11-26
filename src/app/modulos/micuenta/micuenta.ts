import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';
import { AvisoToast } from '../../compartido/componentes/aviso-toast/aviso-toast';
import { ModalConfirmacion } from '../../compartido/componentes/modal-confirmacion/modal-confirmacion';
import {
  cvv,
  codigoPostal5,
  coincide,
  passwordFuerte,
  rfcValido,
  tarjetaLuhn,
  telefono10,
  vencimientoFuturo,
} from '../../compartido/validadores/validadores-negocio';
import { mensajeError } from '../../core/api/errores';
import { formatearDinero } from '../../core/api/formato';
import { AuthSessionService } from '../../core/auth/auth-session.service';
import { AvisosServicio } from '../../nucleo/servicios/avisos-servicio';
import {
  CPS_CON_COBERTURA_EJEMPLO,
  DIRECCIONES_EJEMPLO,
  MEDIOS_EJEMPLO,
  PERFIL_EJEMPLO,
} from './datos-simulados/cuenta-ejemplo';
import type {
  DatosActualizacionPerfil,
  DireccionCliente,
  MedioPagoSimulado,
  PerfilCuenta,
  TipoDireccion,
} from './modelos/cuenta';
import { CuentaServicio } from './servicios/cuenta-servicio';

// M05 importa estos tipos desde aquí; se conserva la superficie pública existente.
export type { DireccionCliente, MedioPagoSimulado } from './modelos/cuenta';

type Pestana = 'datos' | 'direcciones' | 'pagos' | 'seguridad';
type Confirmacion = 'direccion' | 'pago' | 'sesiones' | 'desactivar' | null;
type EstadoCobertura = 'sin-consultar' | 'consultando' | 'disponible' | 'sin-cobertura';

@Component({
  selector: 'app-micuenta',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, AvisoToast, ModalConfirmacion],
  templateUrl: './micuenta.html',
  styleUrl: './micuenta.css',
})
export class Micuenta {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly cuenta = inject(CuentaServicio);
  private readonly sesion = inject(AuthSessionService);
  private readonly avisos = inject(AvisosServicio);

  protected readonly formatearDinero = formatearDinero;
  protected readonly correoOriginal = signal('');

  protected readonly pestanas: ReadonlyArray<{ id: Pestana; etiqueta: string }> = [
    { id: 'datos', etiqueta: 'Mis datos' },
    { id: 'direcciones', etiqueta: 'Direcciones' },
    { id: 'pagos', etiqueta: 'Medios de pago' },
    { id: 'seguridad', etiqueta: 'Seguridad' },
  ];

  protected readonly pestana = signal<Pestana>('datos');
  protected readonly perfil = signal<PerfilCuenta | null>(null);
  protected readonly direcciones = signal<DireccionCliente[]>([]);
  protected readonly mediosPago = signal<MedioPagoSimulado[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal('');
  protected readonly modoDemo = signal(false);
  protected readonly guardando = signal(false);
  protected readonly cobertura = signal<EstadoCobertura>('sin-consultar');
  protected readonly mostrandoFormDireccion = signal(false);
  protected readonly editandoDireccionId = signal<number | null>(null);
  protected readonly tipoPago = signal<'tarjeta' | 'cuenta'>('tarjeta');
  protected readonly editandoAliasId = signal<number | null>(null);
  protected readonly confirmacion = signal<Confirmacion>(null);
  protected readonly idPendiente = signal<number | null>(null);

  readonly formDatos = this.fb.nonNullable.group(
    {
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      telefono: ['', [Validators.required, telefono10]],
      correo: ['', [Validators.required, Validators.email]],
      contrasenaActual: [''],
    },
    { validators: [this.emailRequiereContrasena()] },
  );

  readonly formDireccion = this.fb.nonNullable.group(
    {
      tipo: this.fb.nonNullable.control<TipoDireccion>('envio'),
      alias: ['', [Validators.required, Validators.maxLength(40)]],
      destinatario: ['', Validators.required],
      telefono: ['', [Validators.required, telefono10]],
      calle: ['', Validators.required],
      numExt: ['', Validators.required],
      numInt: [''],
      colonia: ['', Validators.required],
      municipio: ['', Validators.required],
      estado: ['', Validators.required],
      cp: ['', [Validators.required, codigoPostal5]],
      referencia: [''],
      predeterminada: [false],
      rfc: [''],
      razonSocial: [''],
    },
    { validators: [this.datosFacturacionRequeridos()] },
  );

  readonly formTarjeta = this.fb.nonNullable.group({
    alias: ['', Validators.required],
    numero: ['', [Validators.required, tarjetaLuhn]],
    titular: ['', Validators.required],
    vencimiento: ['', [Validators.required, vencimientoFuturo]],
    cvv: ['', [Validators.required, cvv]],
  });

  readonly formCuenta = this.fb.nonNullable.group({
    alias: ['', Validators.required],
    titular: ['', Validators.required],
    saldoInicial: [1000, [Validators.required, Validators.min(0)]],
  });

  readonly formAlias = this.fb.nonNullable.group({
    alias: ['', Validators.required],
  });

  readonly formSeguridad = this.fb.nonNullable.group(
    {
      contrasenaActual: ['', Validators.required],
      nuevaContrasena: ['', [Validators.required, passwordFuerte]],
      confirmarContrasena: ['', Validators.required],
    },
    { validators: [coincide('nuevaContrasena', 'confirmarContrasena')] },
  );

  constructor() {
    this.cargar();

    this.formDireccion.controls.cp.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((cp) => this.consultarCobertura(cp));
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set('');
    forkJoin({
      perfil: this.cuenta.perfil(),
      direcciones: this.cuenta.listarDirecciones(),
      medios: this.cuenta.listarMediosPago(),
    }).subscribe({
      next: ({ perfil, direcciones, medios }) => {
        this.modoDemo.set(false);
        this.perfil.set(perfil);
        this.direcciones.set(direcciones);
        this.mediosPago.set(medios);
        this.formDatos.patchValue({
          nombre: perfil.nombre,
          apellidos: perfil.apellidos,
          telefono: perfil.telefono,
          correo: perfil.correo,
          contrasenaActual: '',
        });
        this.formDatos.markAsPristine();
        this.correoOriginal.set(perfil.correo);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        this.errorCarga.set(mensajeError(error, 'No fue posible cargar la información de tu cuenta.'));
        this.cargando.set(false);
      },
    });
  }

  /** Vista de demostración explícita: no envía nada y no simula persistencia. */
  protected cargarEjemplo(): void {
    this.perfil.set({ ...PERFIL_EJEMPLO });
    this.direcciones.set(DIRECCIONES_EJEMPLO.map((direccion) => ({ ...direccion })));
    this.mediosPago.set(MEDIOS_EJEMPLO.map((medio) => ({ ...medio })));
    this.formDatos.patchValue({
      nombre: PERFIL_EJEMPLO.nombre,
      apellidos: PERFIL_EJEMPLO.apellidos,
      telefono: PERFIL_EJEMPLO.telefono,
      correo: PERFIL_EJEMPLO.correo,
      contrasenaActual: '',
    });
    this.formDatos.markAsPristine();
    this.correoOriginal.set(PERFIL_EJEMPLO.correo);
    this.modoDemo.set(true);
    this.errorCarga.set('');
    this.cargando.set(false);
    this.avisos.mostrar(
      'informacion',
      'Datos de ejemplo cargados. Solo existen en esta pantalla y no se guardan.',
    );
  }

  protected cambiarPestana(tab: Pestana): void {
    this.pestana.set(tab);
    this.editandoAliasId.set(null);
  }

  protected tieneError(control: AbstractControl | null, clave: string): boolean {
    if (!control?.hasError(clave)) return false;
    return control.touched || control.dirty;
  }

  protected correoCambio(): boolean {
    const actual = this.formDatos.controls.correo.value.trim().toLowerCase();
    return actual !== this.correoOriginal().trim().toLowerCase();
  }

  protected guardarDatos(): void {
    if (this.formDatos.invalid) {
      this.formDatos.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa los campos marcados antes de continuar.');
      return;
    }

    const valor = this.formDatos.getRawValue();
    const cambios: DatosActualizacionPerfil = {
      nombre: valor.nombre.trim(),
      apellidos: valor.apellidos.trim(),
      telefono: valor.telefono.trim(),
    };

    if (this.correoCambio()) {
      cambios.correo = valor.correo.trim();
      cambios.contrasena_actual = valor.contrasenaActual;
    }

    if (this.modoDemo()) {
      this.perfil.update((actual) =>
        actual
          ? {
              ...actual,
              nombre: cambios.nombre,
              apellidos: cambios.apellidos,
              telefono: cambios.telefono,
              correo: cambios.correo ?? actual.correo,
            }
          : actual,
      );
      this.correoOriginal.set(cambios.correo ?? this.correoOriginal());
      this.formDatos.controls.contrasenaActual.reset('');
      this.formDatos.markAsPristine();
      this.avisos.mostrar('informacion', 'Demostración: los cambios no se guardaron en el servidor.');
      return;
    }

    this.guardando.set(true);
    this.cuenta.actualizarPerfil(cambios).subscribe({
      next: (perfil) => {
        this.perfil.set(perfil);
        this.correoOriginal.set(perfil.correo);
        this.formDatos.controls.contrasenaActual.reset('');
        this.formDatos.markAsPristine();
        this.guardando.set(false);
        this.avisos.mostrar('exito', 'Tus datos personales se actualizaron correctamente.');
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.avisos.mostrar('error', mensajeError(error, 'No fue posible guardar tus datos.'));
      },
    });
  }

  protected abrirNuevaDireccion(): void {
    this.editandoDireccionId.set(null);
    this.formDireccion.reset({
      tipo: 'envio',
      alias: '',
      destinatario: '',
      telefono: '',
      calle: '',
      numExt: '',
      numInt: '',
      colonia: '',
      municipio: '',
      estado: '',
      cp: '',
      referencia: '',
      predeterminada: false,
      rfc: '',
      razonSocial: '',
    });
    this.cobertura.set('sin-consultar');
    this.mostrandoFormDireccion.set(true);
  }

  protected editarDireccion(direccion: DireccionCliente): void {
    this.editandoDireccionId.set(direccion.id);
    this.formDireccion.patchValue(direccion);
    this.consultarCobertura(direccion.cp);
    this.mostrandoFormDireccion.set(true);
  }

  protected cerrarFormDireccion(): void {
    this.mostrandoFormDireccion.set(false);
    this.editandoDireccionId.set(null);
  }

  private consultarCobertura(cp: string): void {
    if (!/^\d{5}$/.test(cp)) {
      this.cobertura.set('sin-consultar');
      return;
    }

    if (this.modoDemo()) {
      this.cobertura.set(CPS_CON_COBERTURA_EJEMPLO.has(cp) ? 'disponible' : 'sin-cobertura');
      return;
    }

    this.cobertura.set('consultando');
    this.cuenta.cobertura(cp).subscribe({
      next: (respuesta) => this.cobertura.set(respuesta.cobertura ? 'disponible' : 'sin-cobertura'),
      error: () => this.cobertura.set('sin-cobertura'),
    });
  }

  protected guardarDireccion(): void {
    if (this.formDireccion.invalid) {
      this.formDireccion.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa los campos de la dirección antes de continuar.');
      return;
    }

    const valor = this.formDireccion.getRawValue();
    const direccion: DireccionCliente = {
      id: this.editandoDireccionId() ?? 0,
      tipo: valor.tipo,
      alias: valor.alias.trim(),
      destinatario: valor.destinatario.trim(),
      telefono: valor.telefono.trim(),
      calle: valor.calle.trim(),
      numExt: valor.numExt.trim(),
      numInt: valor.numInt.trim(),
      colonia: valor.colonia.trim(),
      municipio: valor.municipio.trim(),
      estado: valor.estado.trim(),
      cp: valor.cp.trim(),
      referencia: valor.referencia.trim(),
      predeterminada: valor.predeterminada,
      rfc: valor.tipo === 'facturacion' ? valor.rfc.trim().toUpperCase() : '',
      razonSocial: valor.tipo === 'facturacion' ? valor.razonSocial.trim() : '',
    };

    const idEdicion = this.editandoDireccionId();
    const aplicar = (guardada: DireccionCliente): void => {
      this.direcciones.update((items) => {
        const ajustadas = guardada.predeterminada
          ? items.map((item) =>
              item.tipo === guardada.tipo && item.id !== guardada.id
                ? { ...item, predeterminada: false }
                : item,
            )
          : items;
        const existe = ajustadas.some((item) => item.id === guardada.id);
        return existe
          ? ajustadas.map((item) => (item.id === guardada.id ? guardada : item))
          : [...ajustadas, guardada];
      });
      this.cerrarFormDireccion();
      this.avisos.mostrar('exito', 'La dirección se guardó correctamente.');
    };

    if (this.modoDemo()) {
      aplicar({ ...direccion, id: idEdicion ?? Date.now() });
      return;
    }

    this.guardando.set(true);
    const operacion =
      idEdicion === null
        ? this.cuenta.crearDireccion(direccion)
        : this.cuenta.actualizarDireccion(idEdicion, direccion);
    operacion.subscribe({
      next: (guardada) => {
        this.guardando.set(false);
        aplicar(guardada);
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.avisos.mostrar('error', mensajeError(error, 'No fue posible guardar la dirección.'));
      },
    });
  }

  protected pedirEliminarDireccion(id: number): void {
    this.idPendiente.set(id);
    this.confirmacion.set('direccion');
  }

  protected guardarMedioPago(): void {
    const esTarjeta = this.tipoPago() === 'tarjeta';
    const form = esTarjeta ? this.formTarjeta : this.formCuenta;
    if (form.invalid) {
      form.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa los datos del medio de pago antes de continuar.');
      return;
    }

    if (esTarjeta) {
      const valor = this.formTarjeta.getRawValue();
      const numero = valor.numero.replace(/\s+/g, '');
      const partesVencimiento = valor.vencimiento.split('/');
      const cuerpo = {
        tipo: 'TARJETA',
        alias: valor.alias.trim(),
        titular: valor.titular.trim(),
        numero_tarjeta: numero,
        vence_mes: Number(partesVencimiento[0]),
        vence_anio: 2000 + Number(partesVencimiento[1]),
        cvv: valor.cvv,
      };
      this.enviarMedioPago(cuerpo, () => ({
        id: Date.now(),
        tipo: 'tarjeta',
        alias: valor.alias.trim(),
        titular: valor.titular.trim(),
        marca: numero.startsWith('4') ? 'VISA' : numero.startsWith('5') ? 'MASTERCARD' : 'OTRA',
        ultimos4: numero.slice(-4),
        vencimiento: valor.vencimiento,
      }));
      return;
    }

    const valor = this.formCuenta.getRawValue();
    const cuerpo = {
      tipo: 'CUENTA',
      alias: valor.alias.trim(),
      titular: valor.titular.trim(),
      saldo_inicial: Number(valor.saldoInicial),
    };
    this.enviarMedioPago(cuerpo, () => ({
      id: Date.now(),
      tipo: 'cuenta',
      alias: valor.alias.trim(),
      titular: valor.titular.trim(),
      saldo: Number(valor.saldoInicial),
    }));
  }

  private enviarMedioPago(
    cuerpo: Record<string, unknown>,
    ejemplo: () => MedioPagoSimulado,
  ): void {
    if (this.modoDemo()) {
      this.mediosPago.update((items) => [...items, ejemplo()]);
      this.limpiarFormulariosPago();
      this.avisos.mostrar(
        'informacion',
        'Demostración: el medio de pago solo existe en esta pantalla.',
      );
      return;
    }

    this.guardando.set(true);
    this.cuenta.crearMedioPago(cuerpo).subscribe({
      next: (medio) => {
        this.mediosPago.update((items) => [...items, medio]);
        this.limpiarFormulariosPago();
        this.guardando.set(false);
        this.avisos.mostrar('exito', 'El medio de pago se agregó correctamente.');
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.avisos.mostrar('error', mensajeError(error, 'No fue posible agregar el medio de pago.'));
      },
    });
  }

  private limpiarFormulariosPago(): void {
    this.formTarjeta.reset({ alias: '', numero: '', titular: '', vencimiento: '', cvv: '' });
    this.formCuenta.reset({ alias: '', titular: '', saldoInicial: 1000 });
  }

  protected esTarjetaVencida(medio: MedioPagoSimulado): boolean {
    if (medio.tipo !== 'tarjeta' || !medio.vencimiento) return false;
    const partes = medio.vencimiento.split('/');
    const mes = Number(partes[0]);
    const anio = 2000 + Number(partes[1]);
    return new Date(anio, mes, 1) <= new Date();
  }

  protected empezarEdicionAlias(medio: MedioPagoSimulado): void {
    this.editandoAliasId.set(medio.id);
    this.formAlias.setValue({ alias: medio.alias });
  }

  protected guardarAlias(id: number): void {
    if (this.formAlias.invalid) {
      this.formAlias.markAllAsTouched();
      return;
    }

    const alias = this.formAlias.getRawValue().alias.trim();
    const aplicar = (actualizado: MedioPagoSimulado): void => {
      this.mediosPago.update((items) => items.map((item) => (item.id === id ? actualizado : item)));
      this.editandoAliasId.set(null);
      this.avisos.mostrar('exito', 'El alias se actualizó correctamente.');
    };

    if (this.modoDemo()) {
      const actual = this.mediosPago().find((item) => item.id === id);
      if (actual) aplicar({ ...actual, alias });
      return;
    }

    this.cuenta.actualizarMedioPago(id, alias).subscribe({
      next: aplicar,
      error: (error: unknown) =>
        this.avisos.mostrar('error', mensajeError(error, 'No fue posible actualizar el alias.')),
    });
  }

  protected pedirEliminarPago(id: number): void {
    this.idPendiente.set(id);
    this.confirmacion.set('pago');
  }

  protected cambiarContrasena(): void {
    if (this.formSeguridad.invalid) {
      this.formSeguridad.markAllAsTouched();
      this.avisos.mostrar('error', 'Revisa los campos de seguridad antes de continuar.');
      return;
    }

    const valor = this.formSeguridad.getRawValue();
    if (this.modoDemo()) {
      this.formSeguridad.reset();
      this.avisos.mostrar(
        'informacion',
        'Demostración: Flask validaría tu contraseña actual y actualizaría el hash.',
      );
      return;
    }

    this.guardando.set(true);
    this.cuenta.cambiarContrasena(valor.contrasenaActual, valor.nuevaContrasena).subscribe({
      next: () => {
        this.formSeguridad.reset();
        this.guardando.set(false);
        this.avisos.mostrar('exito', 'Tu contraseña se actualizó correctamente.');
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.avisos.mostrar('error', mensajeError(error, 'No fue posible cambiar la contraseña.'));
      },
    });
  }

  protected pedirCerrarSesiones(): void {
    this.confirmacion.set('sesiones');
  }

  protected pedirDesactivarCuenta(): void {
    this.confirmacion.set('desactivar');
  }

  protected textoConfirmacion(): { titulo: string; mensaje: string; etiqueta: string } {
    switch (this.confirmacion()) {
      case 'direccion':
        return {
          titulo: 'Desactivar dirección',
          mensaje:
            'La dirección dejará de estar disponible para nuevas compras. Las ventas anteriores conservan su copia.',
          etiqueta: 'Desactivar',
        };
      case 'pago':
        return {
          titulo: 'Eliminar medio de pago',
          mensaje: 'El medio de pago dejará de mostrarse en tu cuenta.',
          etiqueta: 'Eliminar',
        };
      case 'sesiones':
        return {
          titulo: 'Cerrar sesión',
          mensaje:
            'Se cerrará la sesión de este dispositivo. Revocar todas las sesiones depende de un endpoint de Flask aún no documentado en §9.',
          etiqueta: 'Cerrar sesión',
        };
      case 'desactivar':
        return {
          titulo: 'Desactivar cuenta',
          mensaje:
            'Tu cuenta pasará al estado INACTIVA. Tu historial de pedidos y compras se conserva.',
          etiqueta: 'Desactivar cuenta',
        };
      default:
        return { titulo: 'Confirmar acción', mensaje: '', etiqueta: 'Confirmar' };
    }
  }

  protected cancelarConfirmacion(): void {
    this.confirmacion.set(null);
    this.idPendiente.set(null);
  }

  protected confirmarAccion(): void {
    const tipo = this.confirmacion();
    const id = this.idPendiente();
    this.cancelarConfirmacion();

    switch (tipo) {
      case 'direccion':
        if (id !== null) this.eliminarDireccion(id);
        break;
      case 'pago':
        if (id !== null) this.eliminarPago(id);
        break;
      case 'sesiones':
        this.cerrarSesiones();
        break;
      case 'desactivar':
        this.desactivarCuenta();
        break;
      default:
        break;
    }
  }

  private eliminarDireccion(id: number): void {
    if (this.modoDemo()) {
      this.direcciones.update((items) => items.filter((item) => item.id !== id));
      this.avisos.mostrar('informacion', 'Demostración: la dirección solo se ocultó en pantalla.');
      return;
    }

    this.cuenta.eliminarDireccion(id).subscribe({
      next: () => {
        this.direcciones.update((items) => items.filter((item) => item.id !== id));
        this.avisos.mostrar('exito', 'La dirección se desactivó correctamente.');
      },
      error: (error: unknown) =>
        this.avisos.mostrar('error', mensajeError(error, 'No fue posible desactivar la dirección.')),
    });
  }

  private eliminarPago(id: number): void {
    if (this.modoDemo()) {
      this.mediosPago.update((items) => items.filter((item) => item.id !== id));
      this.avisos.mostrar('informacion', 'Demostración: el medio de pago solo se ocultó en pantalla.');
      return;
    }

    this.cuenta.eliminarMedioPago(id).subscribe({
      next: () => {
        this.mediosPago.update((items) => items.filter((item) => item.id !== id));
        this.avisos.mostrar('exito', 'El medio de pago se eliminó correctamente.');
      },
      error: (error: unknown) =>
        this.avisos.mostrar('error', mensajeError(error, 'No fue posible eliminar el medio de pago.')),
    });
  }

  private cerrarSesiones(): void {
    if (this.modoDemo()) {
      this.sesion.cerrarSesionLocal();
      void this.router.navigate(['/login']);
      return;
    }

    this.sesion.cerrarSesion().subscribe(() => void this.router.navigate(['/login']));
  }

  private desactivarCuenta(): void {
    if (this.modoDemo()) {
      this.avisos.mostrar(
        'informacion',
        'Demostración: la desactivación la ejecuta Flask sobre el estado de la cuenta.',
      );
      return;
    }

    this.cuenta.desactivarCuenta().subscribe({
      next: () => {
        this.sesion.cerrarSesionLocal();
        this.avisos.mostrar('exito', 'Tu cuenta quedó inactiva. Tu historial se conserva.');
        void this.router.navigate(['/catalogo']);
      },
      error: (error: unknown) =>
        this.avisos.mostrar('error', mensajeError(error, 'No fue posible desactivar la cuenta.')),
    });
  }

  private emailRequiereContrasena(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const correo = String(control.get('correo')?.value ?? '').trim().toLowerCase();
      const original = this.correoOriginal().trim().toLowerCase();
      if (correo === original || correo === '') return null;

      const contrasena = String(control.get('contrasenaActual')?.value ?? '');
      return contrasena.length > 0 ? null : { contrasenaRequerida: true };
    };
  }

  private datosFacturacionRequeridos(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control.get('tipo')?.value !== 'facturacion') return null;

      const errores: ValidationErrors = {};
      const rfc = control.get('rfc');
      const valorRfc = String(rfc?.value ?? '').trim();
      if (!valorRfc) errores['rfcRequerido'] = true;
      else if (rfc && rfcValido(rfc)) errores['rfcInvalido'] = true;

      if (!String(control.get('razonSocial')?.value ?? '').trim()) {
        errores['razonSocialRequerida'] = true;
      }

      return Object.keys(errores).length > 0 ? errores : null;
    };
  }
}
