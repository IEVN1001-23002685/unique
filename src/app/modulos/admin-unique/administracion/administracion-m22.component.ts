import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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

interface GrupoConfiguracion {
  titulo: string;
  nota: string;
  parametros: ConfiguracionParametro[];
}

/** Estado visible de una pestaña. Permite volver a ella sin repetir la petición HTTP. */
interface EstadoAdministracion {
  usuarios: UsuarioAdmin[];
  clientes: UsuarioAdmin[];
  catalogos: ElementoCatalogo[];
  configuracion: ConfiguracionParametro[];
  configuracionOriginal: ConfiguracionParametro[];
  bitacora: BitacoraRegistro[];
  clienteDetalle: ClienteDetalle | null;
  recurso: RecursoCatalogo;
  filtro: string;
  filtroActivo: boolean | null;
  filtrosBitacora: {
    accion: string;
    entidad: string;
    usuario_id: number | null;
    desde: string;
    hasta: string;
  };
  pagina: number;
  porPagina: number;
  total: number;
}

type FiltrosBitacora = EstadoAdministracion['filtrosBitacora'];

/** Claves del §11.5 del documento; la agrupación es solo presentación, no cambia valores. */
const CLAVES_PROPUESTA = new Set([
  'dias_devolucion',
  'max_intentos_entrega',
  'dias_produccion_estandar',
  'max_piezas_por_linea',
  'saldo_inicial_cuenta_simulada',
  'envio_gratis_desde',
]);
const CLAVES_SEGURIDAD = new Set([
  'intentos_login_max',
  'bloqueo_login_min',
  'vigencia_recuperacion_min',
]);
const CLAVES_ESTANCAMIENTO = new Set([
  'horas_max_recibido',
  'horas_max_confirmado',
  'dias_max_en_produccion',
  'horas_max_en_preparacion',
  'horas_max_listo_envio',
  'horas_max_en_reparto',
  'horas_alerta_devolucion',
  'dias_carrito_abandonado',
]);

@Component({
  selector: 'app-administracion-m22',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './administracion-m22.component.html',
  styleUrls: ['../preparacion/modulos-admin.css', './administracion-m22.css'],
})
export class AdministracionM22Component implements OnInit {
  private readonly servicio = inject(AdministracionService);
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
  filtroActivo: boolean | null = null;
  filtrosBitacora = {
    accion: '',
    entidad: '',
    usuario_id: null as number | null,
    desde: '',
    hasta: '',
  };
  pagina = 1;
  porPagina = 20;
  total = 0;
  cargando = true;
  error = '';
  /** Una entrada por pestaña ya visitada; el botón Actualizar y los filtros la invalidan. */
  private readonly estados: Partial<Record<Pestana, EstadoAdministracion>> = {};
  private pestanaActual: Pestana | null = null;
  aviso = '';
  passwordPendiente: UsuarioAdmin | null = null;

  usuarioForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    apellidos: ['', [Validators.required, Validators.maxLength(120)]],
    correo: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    rol: ['OPERATIVO' as 'CLIENTE' | 'OPERATIVO' | 'ADMIN', Validators.required],
    acepta_promociones: [false],
  });

  /** Usuarios y clientes sí paginan en Flask; catálogos y bitácora usan filtros estrictos. */
  get totalPaginas(): number {
    if (this.pestana === 'usuarios' || this.pestana === 'clientes') {
      return Math.max(1, Math.ceil(this.total / this.porPagina));
    }
    return 1;
  }

  get campos(): (typeof CAMPOS_CATALOGO)[RecursoCatalogo] {
    return CAMPOS_CATALOGO[this.recurso];
  }

  get hayMasCatalogos(): boolean {
    return this.pestana === 'catalogos' && this.total > this.catalogos.length;
  }

  get hayMasBitacora(): boolean {
    return this.pestana === 'bitacora' && this.total > this.bitacora.length;
  }

  get todosLosUsuariosCargados(): boolean {
    return this.usuarios.length >= this.total;
  }

  /** La API solo edita claves existentes: sin siembra no hay parámetros que mostrar. */
  get configuracionVacia(): boolean {
    return (
      !this.cargando &&
      !this.error &&
      this.pestana === 'configuracion' &&
      this.configuracion.length === 0
    );
  }

  get catalogoVacio(): boolean {
    return (
      !this.cargando && !this.error && this.pestana === 'catalogos' && this.catalogos.length === 0
    );
  }

  get gruposConfiguracion(): GrupoConfiguracion[] {
    const conocidas = new Set([
      ...CLAVES_PROPUESTA,
      ...CLAVES_SEGURIDAD,
      ...CLAVES_ESTANCAMIENTO,
    ]);
    const grupos: GrupoConfiguracion[] = [
      {
        titulo: 'Negocio y calidad',
        nota: 'Parámetros definidos en el documento para precios, merma y proveedores.',
        parametros: this.configuracion.filter((p) => !conocidas.has(p.clave)),
      },
      {
        titulo: 'Estancamiento y alertas',
        nota: 'Umbrales que M21 usa para detectar pedidos detenidos.',
        parametros: this.configuracion.filter((p) => CLAVES_ESTANCAMIENTO.has(p.clave)),
      },
      {
        titulo: 'Seguridad',
        nota: 'Bloqueo por intentos fallidos y vigencia de recuperación.',
        parametros: this.configuracion.filter((p) => CLAVES_SEGURIDAD.has(p.clave)),
      },
      {
        titulo: 'Propuestas pendientes de confirmación',
        nota: 'El documento las marca como propuesta: no están definidas y deben confirmarse antes de usarlas como regla.',
        parametros: this.configuracion.filter((p) => CLAVES_PROPUESTA.has(p.clave)),
      },
    ];
    return grupos.filter((grupo) => grupo.parametros.length > 0);
  }

  ngOnInit(): void {
    const secciones: Record<string, Pestana> = {
      usuarios: 'usuarios',
      clientes: 'clientes',
      catalogos: 'catalogos',
      configuracion: 'configuracion',
      bitacora: 'bitacora',
    };
    this.ruta.paramMap.subscribe((params) => {
      this.activarPestana(secciones[params.get('seccion') ?? ''] ?? 'usuarios');
    });
  }

  cambiar(pestana: Pestana): void {
    if (pestana === this.pestana) return;
    this.activarPestana(pestana);
    void this.router.navigate(['/panel-admin/sistema', pestana]);
  }

  /** Cambia de sección reutilizando el estado ya cargado; solo pide datos en la primera visita. */
  private activarPestana(destino: Pestana): void {
    if (this.pestanaActual === destino) return;
    if (this.pestanaActual && !this.cargando) this.guardar(this.pestanaActual);

    const cached = this.estados[destino];
    this.pestana = destino;
    this.pestanaActual = destino;

    if (cached) {
      this.restaurar(cached);
      this.cargando = false;
      this.error = '';
      this.aviso = '';
      this.passwordPendiente = null;
      return;
    }

    this.pagina = 1;
    this.filtro = '';
    this.filtroActivo = null;
    this.filtrosBitacora = this.filtrosVacios();
    this.error = '';
    this.aviso = '';
    this.clienteDetalle = null;
    this.passwordPendiente = null;
    this.cargar();
  }

  private filtrosVacios(): FiltrosBitacora {
    return { accion: '', entidad: '', usuario_id: null, desde: '', hasta: '' };
  }

  private guardar(pestana: Pestana): void {
    const base: EstadoAdministracion = {
      usuarios: [],
      clientes: [],
      catalogos: [],
      configuracion: [],
      configuracionOriginal: [],
      bitacora: [],
      clienteDetalle: null,
      recurso: 'color',
      filtro: '',
      filtroActivo: null,
      filtrosBitacora: this.filtrosVacios(),
      pagina: this.pagina,
      porPagina: this.porPagina,
      total: this.total,
    };

    if (pestana === 'usuarios') {
      base.usuarios = [...this.usuarios];
      base.filtro = this.filtro;
    } else if (pestana === 'clientes') {
      base.clientes = [...this.clientes];
      base.filtro = this.filtro;
      base.clienteDetalle = this.clienteDetalle;
    } else if (pestana === 'catalogos') {
      base.catalogos = [...this.catalogos];
      base.recurso = this.recurso;
      base.filtro = this.filtro;
      base.filtroActivo = this.filtroActivo;
    } else if (pestana === 'configuracion') {
      base.configuracion = this.configuracion.map((p) => ({ ...p }));
      base.configuracionOriginal = this.configuracionOriginal.map((p) => ({ ...p }));
    } else {
      base.bitacora = [...this.bitacora];
      base.filtrosBitacora = { ...this.filtrosBitacora };
    }
    this.estados[pestana] = base;
  }

  private restaurar(estado: EstadoAdministracion): void {
    this.usuarios = [...estado.usuarios];
    this.clientes = [...estado.clientes];
    this.catalogos = [...estado.catalogos];
    this.configuracion = estado.configuracion.map((p) => ({ ...p }));
    this.configuracionOriginal = estado.configuracionOriginal.map((p) => ({ ...p }));
    this.bitacora = [...estado.bitacora];
    this.clienteDetalle = estado.clienteDetalle;
    this.recurso = estado.recurso;
    this.filtro = estado.filtro;
    this.filtroActivo = estado.filtroActivo;
    this.filtrosBitacora = { ...estado.filtrosBitacora };
    this.pagina = estado.pagina;
    this.porPagina = estado.porPagina;
    this.total = estado.total;
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
    delete this.estados['usuarios'];
    this.servicio.listarUsuarios({ pagina: this.pagina, por_pagina: this.porPagina }).subscribe({
      next: (respuesta) => {
        if (this.pestanaActual !== 'usuarios') return;
        this.usuarios = respuesta.items;
        this.aplicarPagina(respuesta.total, respuesta.pagina, respuesta.por_pagina);
        this.guardar('usuarios');
      },
      error: (error: unknown) => {
        if (this.pestanaActual !== 'usuarios') return;
        this.error = mensajeError(error, 'No se pudo cargar la lista de usuarios.');
        this.cargando = false;
      },
    });
  }

  private cargarClientes(): void {
    delete this.estados['clientes'];
    this.servicio.listarClientes({ pagina: this.pagina, por_pagina: this.porPagina }).subscribe({
      next: (respuesta) => {
        if (this.pestanaActual !== 'clientes') return;
        this.clientes = respuesta.items;
        this.aplicarPagina(respuesta.total, respuesta.pagina, respuesta.por_pagina);
        this.guardar('clientes');
      },
      error: (error: unknown) => {
        if (this.pestanaActual !== 'clientes') return;
        this.error = mensajeError(error, 'No se pudo cargar el directorio de clientes.');
        this.cargando = false;
      },
    });
  }

  private cargarCatalogo(): void {
    delete this.estados['catalogos'];
    this.servicio
      .listarCatalogo(this.recurso, {
        q: this.filtro || undefined,
        activa: this.filtroActivo ?? undefined,
      })
      .subscribe({
        next: (respuesta) => {
          if (this.pestanaActual !== 'catalogos') return;
          this.catalogos = respuesta.items;
          this.aplicarPagina(respuesta.total, respuesta.pagina, respuesta.por_pagina);
          this.guardar('catalogos');
        },
        error: (error: unknown) => {
          if (this.pestanaActual !== 'catalogos') return;
          this.error = mensajeError(error, 'No se pudo cargar el catálogo.');
          this.cargando = false;
        },
      });
  }

  private cargarConfiguracion(): void {
    delete this.estados['configuracion'];
    this.servicio.listarConfiguracion().subscribe({
      next: (parametros) => {
        if (this.pestanaActual !== 'configuracion') return;
        this.configuracion = parametros;
        this.configuracionOriginal = parametros.map((p) => ({ ...p }));
        this.total = parametros.length;
        this.cargando = false;
        this.guardar('configuracion');
      },
      error: (error: unknown) => {
        if (this.pestanaActual !== 'configuracion') return;
        this.error = mensajeError(error, 'No se pudo cargar la configuración.');
        this.cargando = false;
      },
    });
  }

  cargarBitacora(): void {
    delete this.estados['bitacora'];
    this.servicio
      .listarBitacora({
        accion: this.filtrosBitacora.accion || undefined,
        entidad: this.filtrosBitacora.entidad || undefined,
        usuario_id: this.filtrosBitacora.usuario_id ?? undefined,
        desde: this.filtrosBitacora.desde || undefined,
        hasta: this.filtrosBitacora.hasta || undefined,
      })
      .subscribe({
        next: (respuesta) => {
          if (this.pestanaActual !== 'bitacora') return;
          this.bitacora = respuesta.items;
          this.aplicarPagina(respuesta.total, respuesta.pagina, respuesta.por_pagina);
          this.guardar('bitacora');
        },
        error: (error: unknown) => {
          if (this.pestanaActual !== 'bitacora') return;
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

  limpiarFiltrosBitacora(): void {
    this.filtrosBitacora = { accion: '', entidad: '', usuario_id: null, desde: '', hasta: '' };
    this.pagina = 1;
    this.cargarBitacora();
  }

  reintentar(): void {
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
    if (!valores.rol) {
      this.error = 'Selecciona el rol de la cuenta.';
      return;
    }
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
        rol: valores.rol,
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

  esUltimoAdminVisible(usuario: UsuarioAdmin): boolean {
    if (usuario.rol !== 'ADMIN' || usuario.estado_cuenta !== 'ACTIVA') return false;
    if (!this.todosLosUsuariosCargados) return false;
    return (
      this.usuarios.filter((u) => u.rol === 'ADMIN' && u.estado_cuenta === 'ACTIVA').length <= 1
    );
  }

  alternarEstado(usuario: UsuarioAdmin): void {
    if (this.esUltimoAdminVisible(usuario)) {
      this.error = 'No se puede desactivar al último Administrador. Flask también lo rechaza.';
      return;
    }
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

  /** No existe endpoint de restablecimiento en el contrato verificado: solo se explica al usuario. */
  restablecerContrasena(usuario: UsuarioAdmin): void {
    this.passwordPendiente = usuario;
    this.error = '';
  }

  cerrarRestablecimiento(): void {
    this.passwordPendiente = null;
  }

  verCliente(id: number): void {
    this.error = '';
    this.clienteDetalle = null;
    this.servicio.obtenerCliente(id).subscribe({
      next: (detalle) => {
        if (this.pestanaActual !== 'clientes') return;
        this.clienteDetalle = detalle;
        this.guardar('clientes');
      },
      error: (error: unknown) => {
        if (this.pestanaActual !== 'clientes') return;
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
    this.filtroActivo = null;
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
      if (this.editandoCatalogo && campo.soloCreacion) continue;
      const valor = this.catalogoDatos[campo.nombre];
      if (valor === '' && campo.tipo === 'numero') continue;
      datos[campo.nombre] =
        campo.tipo === 'numero' && valor !== null && valor !== '' ? Number(valor) : valor;
      if (
        (campo.nombre === 'codigo' || campo.nombre === 'prefijo_sku') &&
        typeof datos[campo.nombre] === 'string'
      ) {
        datos[campo.nombre] = String(datos[campo.nombre]).trim().toUpperCase();
      }
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
    const nombre = String(elemento['nombre'] ?? ' este elemento');
    if (!confirm(`¿Desactivar o eliminar "${nombre}"? Flask validará si ya se usó; un código que generó SKU solo puede desactivarse.`)) return;
    this.error = '';
    this.servicio.eliminarCatalogo(this.recurso, elemento.id).subscribe({
      next: () => {
        this.aviso = 'Elemento desactivado o eliminado según sus relaciones.';
        this.cargarCatalogo();
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo desactivar el elemento.');
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
