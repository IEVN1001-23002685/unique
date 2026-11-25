import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { mensajeError } from '../../../core/api/errores';
import {
  AdministracionService,
  CAMPOS_CATALOGO,
  DatosUsuarioActualizar,
  RECURSOS_CATALOGO,
  ValorCatalogo,
} from '../services/administracion.service';
import {
  BitacoraRegistro,
  ClienteDetalle,
  ConfiguracionParametro,
  ElementoCatalogo,
  RecursoCatalogo,
  UsuarioAdmin,
} from '../services/ui-admin.models';

type Pestana = 'usuarios' | 'clientes' | 'catalogos' | 'configuracion' | 'bitacora';

@Component({
  selector: 'app-administracion-m22',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './administracion-m22.component.html',
  styleUrl: '../preparacion/modulos-admin.css',
})
export class AdministracionM22Component implements OnInit {
  private readonly servicio = inject(AdministracionService);
  private readonly fb = inject(FormBuilder);

  readonly recursos = RECURSOS_CATALOGO;
  readonly camposCatalogo = CAMPOS_CATALOGO;

  pestana: Pestana = 'usuarios';
  usuarios: UsuarioAdmin[] = [];
  clientes: UsuarioAdmin[] = [];
  catalogos: ElementoCatalogo[] = [];
  configuracion: ConfiguracionParametro[] = [];
  configuracionOriginal: ConfiguracionParametro[] = [];
  bitacora: BitacoraRegistro[] = [];
  clienteDetalle: ClienteDetalle | null = null;
  recurso: RecursoCatalogo = 'color';
  editandoUsuario: number | null = null;
  editandoCatalogo: number | null = null;
  catalogoDatos: Record<string, ValorCatalogo> = {};
  filtro = '';
  filtrosBitacora = { accion: '', entidad: '', usuario_id: null as number | null, desde: '', hasta: '' };
  pagina = 1;
  porPagina = 20;
  total = 0;
  cargando = true;
  error = '';
  aviso = '';

  usuarioForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    apellidos: ['', [Validators.required, Validators.maxLength(120)]],
    correo: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    rol: ['OPERATIVO' as 'CLIENTE' | 'OPERATIVO' | 'ADMIN', Validators.required],
    acepta_promociones: [false],
  });

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total / this.porPagina));
  }

  get campos(): (typeof CAMPOS_CATALOGO)[RecursoCatalogo] {
    return CAMPOS_CATALOGO[this.recurso];
  }

  ngOnInit(): void {
    this.cargar();
  }

  cambiar(pestana: Pestana): void {
    this.pestana = pestana;
    this.pagina = 1;
    this.filtro = '';
    this.error = '';
    this.aviso = '';
    this.clienteDetalle = null;
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    if (this.pestana === 'usuarios') return this.cargarUsuarios();
    if (this.pestana === 'clientes') return this.cargarClientes();
    if (this.pestana === 'catalogos') return this.cargarCatalogo();
    if (this.pestana === 'configuracion') return this.cargarConfiguracion();
    this.cargarBitacora();
  }

  private aplicarPagina(total: number, pagina: number, porPagina: number): void {
    this.total = total;
    this.pagina = pagina;
    this.porPagina = porPagina;
    this.cargando = false;
  }

  private cargarUsuarios(): void {
    this.servicio.listarUsuarios({ pagina: this.pagina, por_pagina: this.porPagina }).subscribe({
      next: (respuesta) => {
        this.usuarios = respuesta.items;
        this.aplicarPagina(respuesta.total, respuesta.pagina, respuesta.por_pagina);
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo cargar la lista de usuarios.');
        this.cargando = false;
      },
    });
  }

  private cargarClientes(): void {
    this.servicio.listarClientes({ pagina: this.pagina, por_pagina: this.porPagina }).subscribe({
      next: (respuesta) => {
        this.clientes = respuesta.items;
        this.aplicarPagina(respuesta.total, respuesta.pagina, respuesta.por_pagina);
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo cargar el directorio de clientes.');
        this.cargando = false;
      },
    });
  }

  private cargarCatalogo(): void {
    this.servicio
      .listarCatalogo(this.recurso, {
        q: this.filtro || undefined,
        pagina: this.pagina,
        por_pagina: this.porPagina,
      })
      .subscribe({
        next: (respuesta) => {
          this.catalogos = respuesta.items;
          this.aplicarPagina(respuesta.total, respuesta.pagina, respuesta.por_pagina);
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudo cargar el catálogo.');
          this.cargando = false;
        },
      });
  }

  private cargarConfiguracion(): void {
    this.servicio.listarConfiguracion().subscribe({
      next: (parametros) => {
        this.configuracion = parametros;
        this.configuracionOriginal = parametros.map((p) => ({ ...p }));
        this.total = parametros.length;
        this.cargando = false;
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo cargar la configuración.');
        this.cargando = false;
      },
    });
  }

  cargarBitacora(): void {
    this.servicio
      .listarBitacora({
        accion: this.filtrosBitacora.accion || undefined,
        entidad: this.filtrosBitacora.entidad || undefined,
        usuario_id: this.filtrosBitacora.usuario_id ?? undefined,
        desde: this.filtrosBitacora.desde || undefined,
        hasta: this.filtrosBitacora.hasta || undefined,
        pagina: this.pagina,
        por_pagina: this.porPagina,
      })
      .subscribe({
        next: (respuesta) => {
          this.bitacora = respuesta.items;
          this.aplicarPagina(respuesta.total, respuesta.pagina, respuesta.por_pagina);
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudo cargar la bitácora.');
          this.cargando = false;
        },
      });
  }

  cambiarPagina(delta: number): void {
    const destino = this.pagina + delta;
    if (destino < 1 || destino > this.totalPaginas) return;
    this.pagina = destino;
    this.cargar();
  }

  get listaUsuarios(): UsuarioAdmin[] {
    return this.filtrar(this.usuarios);
  }

  get listaClientes(): UsuarioAdmin[] {
    return this.filtrar(this.clientes);
  }

  private filtrar<T extends object>(lista: T[]): T[] {
    const texto = this.filtro.trim().toLowerCase();
    if (!texto) return lista;
    return lista.filter((item) => Object.values(item).join(' ').toLowerCase().includes(texto));
  }

  guardarUsuario(): void {
    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      return;
    }
    const valores = this.usuarioForm.getRawValue();
    this.error = '';
    if (this.editandoUsuario) {
      const cambios: DatosUsuarioActualizar = {
        nombre: valores.nombre ?? undefined,
        apellidos: valores.apellidos ?? undefined,
        telefono: valores.telefono ?? undefined,
        rol: valores.rol ?? undefined,
        acepta_promociones: valores.acepta_promociones ?? undefined,
      };
      this.servicio.actualizarUsuario(this.editandoUsuario, cambios).subscribe({
        next: () => {
          this.aviso = 'Usuario actualizado.';
          this.limpiarUsuario();
          this.cargarUsuarios();
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudo actualizar el usuario.');
        },
      });
      return;
    }
    this.servicio
      .crearUsuario({
        nombre: valores.nombre ?? '',
        apellidos: valores.apellidos ?? '',
        correo: valores.correo ?? '',
        telefono: valores.telefono ?? '',
        password: valores.password ?? '',
        rol: valores.rol ?? 'OPERATIVO',
        acepta_promociones: valores.acepta_promociones ?? false,
      })
      .subscribe({
        next: () => {
          this.aviso = 'Usuario creado.';
          this.limpiarUsuario();
          this.cargarUsuarios();
        },
        error: (error: unknown) => {
          this.error = mensajeError(error, 'No se pudo crear el usuario.');
        },
      });
  }

  editarUsuario(usuario: UsuarioAdmin): void {
    this.editandoUsuario = usuario.id;
    this.usuarioForm.patchValue({
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      telefono: usuario.telefono,
      rol: usuario.rol,
      acepta_promociones: usuario.acepta_promociones,
      password: '',
    });
    this.usuarioForm.controls.password.clearValidators();
    this.usuarioForm.controls.password.updateValueAndValidity();
    this.usuarioForm.controls.correo.disable();
  }

  limpiarUsuario(): void {
    this.editandoUsuario = null;
    this.usuarioForm.reset({ rol: 'OPERATIVO', acepta_promociones: false });
    this.usuarioForm.controls.password.setValidators([
      Validators.required,
      Validators.minLength(8),
      Validators.maxLength(128),
    ]);
    this.usuarioForm.controls.password.updateValueAndValidity();
    this.usuarioForm.controls.correo.enable();
  }

  alternarEstado(usuario: UsuarioAdmin): void {
    const accion = usuario.estado_cuenta === 'ACTIVA' ? 'desactivar' : 'reactivar';
    if (!confirm(`¿${accion} la cuenta de ${usuario.nombre}?`)) return;
    this.error = '';
    const peticion: Observable<unknown> =
      usuario.estado_cuenta === 'ACTIVA'
        ? this.servicio.desactivarUsuario(usuario.id)
        : this.servicio.actualizarUsuario(usuario.id, { estado_cuenta: 'ACTIVA' });
    peticion.subscribe({
      next: () => {
        this.aviso = `Cuenta ${usuario.estado_cuenta === 'ACTIVA' ? 'desactivada' : 'reactivada'} correctamente.`;
        this.cargarUsuarios();
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo cambiar el estado de la cuenta.');
      },
    });
  }

  verCliente(id: number): void {
    this.error = '';
    this.clienteDetalle = null;
    this.servicio.obtenerCliente(id).subscribe({
      next: (detalle) => (this.clienteDetalle = detalle),
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo consultar el detalle del cliente.');
      },
    });
  }

  cambiarRecurso(recurso: RecursoCatalogo): void {
    this.recurso = recurso;
    this.pagina = 1;
    this.editandoCatalogo = null;
    this.catalogoDatos = {};
    this.filtro = '';
    this.cargarCatalogo();
  }

  nuevoCatalogo(): void {
    this.editandoCatalogo = null;
    this.catalogoDatos = this.valoresIniciales();
  }

  private valoresIniciales(): Record<string, ValorCatalogo> {
    const valores: Record<string, ValorCatalogo> = {};
    for (const campo of this.campos) {
      valores[campo.nombre] = campo.tipo === 'booleano' ? true : '';
    }
    return valores;
  }

  editarCatalogo(elemento: ElementoCatalogo): void {
    this.editandoCatalogo = elemento.id;
    this.catalogoDatos = {};
    for (const campo of this.campos) {
      this.catalogoDatos[campo.nombre] = elemento[campo.nombre] ?? null;
    }
  }

  guardarCatalogo(): void {
    const datos: Record<string, ValorCatalogo> = {};
    for (const campo of this.campos) {
      const valor = this.catalogoDatos[campo.nombre];
      if (valor === '' && campo.tipo === 'numero') continue;
      datos[campo.nombre] =
        campo.tipo === 'numero' && valor !== null && valor !== '' ? Number(valor) : valor;
    }
    const requerido: Partial<Record<RecursoCatalogo, string>> = {
      color: 'codigo',
      talla: 'codigo',
      'categoria-producto': 'prefijo_sku',
    };
    const campoRequerido = requerido[this.recurso];
    if (!datos['nombre'] || (campoRequerido && !this.editandoCatalogo && !datos[campoRequerido])) {
      this.error = 'Completa los campos obligatorios del catálogo.';
      return;
    }
    if (this.recurso === 'color' && !/^#[0-9A-Fa-f]{6}$/.test(String(datos['hex'] ?? ''))) {
      this.error = 'El color debe tener el formato #RRGGBB.';
      return;
    }
    if (this.recurso === 'causa-merma' && !['MATERIAL', 'PRODUCTO', 'AMBOS'].includes(String(datos['aplica_a'] ?? ''))) {
      this.error = 'Selecciona una aplicación válida para la causa de merma.';
      return;
    }
    if (this.recurso === 'tarifa-envio') {
      const inicio = String(datos['cp_inicio'] ?? '');
      const fin = String(datos['cp_fin'] ?? '');
      const costo = Number(datos['costo']);
      const dias = Number(datos['dias_estimados']);
      if (!/^\d{5}$/.test(inicio) || !/^\d{5}$/.test(fin) || inicio > fin) {
        this.error = 'Los códigos postales deben tener 5 dígitos y el inicial no puede ser mayor al final.';
        return;
      }
      if (!Number.isFinite(costo) || costo < 0 || !Number.isInteger(dias) || dias < 0) {
        this.error = 'Indica un costo válido y días estimados enteros.';
        return;
      }
      datos['costo'] = costo.toFixed(2);
    }
    this.error = '';
    const peticion = this.editandoCatalogo
      ? this.servicio.actualizarCatalogo(this.recurso, this.editandoCatalogo, datos)
      : this.servicio.crearCatalogo(this.recurso, datos);
    peticion.subscribe({
      next: () => {
        this.aviso = 'Elemento de catálogo guardado.';
        this.nuevoCatalogo();
        this.cargarCatalogo();
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo guardar el elemento de catálogo.');
      },
    });
  }

  eliminarCatalogo(elemento: ElementoCatalogo): void {
    if (!confirm(`¿Eliminar "${elemento['nombre']}"? El backend validará las relaciones existentes.`)) return;
    this.error = '';
    this.servicio.eliminarCatalogo(this.recurso, elemento.id).subscribe({
      next: () => {
        this.aviso = 'Elemento eliminado.';
        this.cargarCatalogo();
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo eliminar el elemento.');
      },
    });
  }

  guardarConfiguracion(): void {
    const cambios: Record<string, string | number> = {};
    for (const parametro of this.configuracion) {
      const original = this.configuracionOriginal.find((p) => p.clave === parametro.clave);
      if (original && original.valor !== parametro.valor) cambios[parametro.clave] = parametro.valor;
    }
    if (!Object.keys(cambios).length) {
      this.aviso = 'No hay parámetros modificados.';
      return;
    }
    this.error = '';
    this.servicio.actualizarConfiguracion(cambios).subscribe({
      next: () => {
        this.aviso = 'Configuración actualizada y auditada.';
        this.cargarConfiguracion();
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo actualizar la configuración.');
      },
    });
  }

  valorElemento(elemento: ElementoCatalogo, campo: string): string {
    const valor = elemento[campo];
    return valor === null || valor === undefined ? '—' : String(valor);
  }
}
