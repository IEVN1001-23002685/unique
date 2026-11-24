import { Injectable, computed, inject, signal } from '@angular/core';
import { CLIENTES_SIMULADOS } from '../../ventas/datos-simulados/clientes';
import { VentasServicio } from '../../ventas/servicios/ventas-servicio';
import { ProductosServicio } from '../../productos/servicios/productos-servicio';
import {
  BITACORA_INICIAL,
  CATALOGOS_INICIALES,
  DEVOLUCIONES_DEMO,
  PARAMETROS_INICIALES,
  USUARIOS_INICIALES,
} from '../datos-simulados/administracion';
import type {
  ClienteSistema,
  DatosCatalogo,
  EntradaCatalogo,
  ParametroSistema,
  RegistroBitacora,
  ResultadoAdmin,
  TipoCatalogo,
  UsuarioSistema,
} from '../modelos/administracion';

export interface DatosUsuario {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  rol: UsuarioSistema['rol'];
  contrasena: string;
}

/**
 * Proyección de solo demostración de M22. Las reglas críticas (hash de
 * contraseña, clave única de catálogo, bloqueos y bitácora inmutable) deben
 * ejecutarse en Flask; aquí solo se valida la interfaz y se deja constancia
 * local de los cambios para que la bitácora sea visible.
 */
@Injectable({
  providedIn: 'root',
})
export class AdministracionSistemaServicio {
  private readonly productos = inject(ProductosServicio);
  private readonly ventas = inject(VentasServicio);

  private readonly usuariosLista = signal<UsuarioSistema[]>(
    USUARIOS_INICIALES.map((usuario) => ({ ...usuario })),
  );
  private readonly catalogosLista = signal<EntradaCatalogo[]>(
    CATALOGOS_INICIALES.map((entrada) => ({ ...entrada })),
  );
  private readonly parametrosLista = signal<ParametroSistema[]>(
    PARAMETROS_INICIALES.map((parametro) => ({ ...parametro })),
  );
  private readonly bitacoraLista = signal<RegistroBitacora[]>(
    BITACORA_INICIAL.map((registro) => ({ ...registro })),
  );

  private consecutivoUsuario = Math.max(...USUARIOS_INICIALES.map((item) => item.id)) + 1;
  private consecutivoCatalogo = Math.max(...CATALOGOS_INICIALES.map((item) => item.id)) + 1;
  private consecutivoBitacora = Math.max(...BITACORA_INICIAL.map((item) => item.id)) + 1;

  readonly usuarios = this.usuariosLista.asReadonly();
  readonly catalogos = this.catalogosLista.asReadonly();
  readonly parametros = this.parametrosLista.asReadonly();
  readonly bitacora = this.bitacoraLista.asReadonly();

  readonly adminsActivos = computed(
    () =>
      this.usuariosLista().filter(
        (usuario) => usuario.rol === 'ADMIN' && usuario.estado === 'ACTIVA',
      ).length,
  );

  readonly clientes = computed<ClienteSistema[]>(() => {
    const saldo = this.parametrosLista().find(
      (parametro) => parametro.clave === 'saldo_inicial_cuenta_simulada',
    )?.valor ?? 5000;
    const ventas = this.ventas.ventas();

    return CLIENTES_SIMULADOS.map((cliente) => {
      const propias = ventas.filter(
        (venta) => venta.cliente === cliente.nombre && venta.estado === 'ACTIVA',
      );
      return {
        id: cliente.id,
        nombre: cliente.nombre,
        correo: cliente.correo,
        telefono: cliente.telefono,
        acceso: cliente.esNuevoSinAcceso ? ('SIN_ACCESO' as const) : ('REGISTRADO' as const),
        compras: propias.length,
        totalCompras: propias.reduce((suma, venta) => suma + venta.total, 0),
        pagosPendientes: propias.filter((venta) => venta.estadoPago === 'PENDIENTE').length,
        devolucionesDemo: DEVOLUCIONES_DEMO[cliente.id] ?? 0,
        saldoSimulado: saldo,
        historial: propias.map((venta) => ({
          folio: venta.folio,
          fecha: venta.fecha,
          total: venta.total,
          estadoPago: venta.estadoPago,
        })),
      };
    });
  });

  entradasDe(tipo: TipoCatalogo): EntradaCatalogo[] {
    return this.catalogosLista().filter((entrada) => entrada.tipo === tipo);
  }

  valorParametro(clave: string): number {
    return this.parametrosLista().find((parametro) => parametro.clave === clave)?.valor ?? 0;
  }

  guardarUsuario(datos: DatosUsuario, id?: number): ResultadoAdmin {
    const correo = datos.correo.trim().toLocaleLowerCase('es-MX');
    const duplicado = this.usuariosLista().some(
      (usuario) => usuario.correo.toLocaleLowerCase('es-MX') === correo && usuario.id !== id,
    );
    if (duplicado) {
      return { ok: false, mensaje: 'Ya existe una cuenta con ese correo electrónico.' };
    }

    if (id === undefined) {
      const usuario: UsuarioSistema = {
        id: this.consecutivoUsuario++,
        nombre: datos.nombre.trim(),
        apellidos: datos.apellidos.trim(),
        correo,
        telefono: datos.telefono.trim(),
        rol: datos.rol,
        estado: 'ACTIVA',
        intentosFallidos: 0,
        ultimoAcceso: null,
        creadoEn: new Date().toISOString(),
      };
      this.usuariosLista.update((lista) => [usuario, ...lista]);
      this.registrar(
        'ALTA_USUARIO',
        'usuario',
        String(usuario.id),
        `Alta de cuenta ${usuario.nombre} ${usuario.apellidos} con rol ${usuario.rol}.`,
      );
      return {
        ok: true,
        mensaje: 'Cuenta creada en memoria. Flask guardará el hash de la contraseña.',
      };
    }

    const original = this.usuariosLista().find((usuario) => usuario.id === id);
    if (!original) {
      return { ok: false, mensaje: 'No encontramos la cuenta indicada.' };
    }
    if (
      original.rol === 'ADMIN' &&
      original.estado === 'ACTIVA' &&
      datos.rol === 'OPERATIVO' &&
      this.adminsActivos() === 1
    ) {
      return {
        ok: false,
        mensaje: 'No se puede cambiar el rol: debe permanecer al menos un Administrador activo.',
      };
    }

    this.usuariosLista.update((lista) =>
      lista.map((usuario) =>
        usuario.id === id
          ? {
              ...usuario,
              nombre: datos.nombre.trim(),
              apellidos: datos.apellidos.trim(),
              correo,
              telefono: datos.telefono.trim(),
              rol: datos.rol,
            }
          : usuario,
      ),
    );
    const cambioRol = original.rol !== datos.rol;
    this.registrar(
      cambioRol ? 'CAMBIO_ROL' : 'ACTUALIZA_USUARIO',
      'usuario',
      String(id),
      cambioRol
        ? `${original.nombre} ${original.apellidos}: rol ${original.rol} → ${datos.rol}.`
        : `Datos de ${original.nombre} ${original.apellidos} actualizados.`,
    );
    return { ok: true, mensaje: 'Cuenta actualizada en memoria y registrada en la bitácora local.' };
  }

  cambiarEstadoUsuario(id: number, activar: boolean): ResultadoAdmin {
    const usuario = this.usuariosLista().find((item) => item.id === id);
    if (!usuario) {
      return { ok: false, mensaje: 'No encontramos la cuenta indicada.' };
    }
    if (!activar && usuario.rol === 'ADMIN' && this.adminsActivos() === 1) {
      return {
        ok: false,
        mensaje: 'No se puede desactivar al último Administrador activo.',
      };
    }

    const estado = activar ? ('ACTIVA' as const) : ('INACTIVA' as const);
    this.usuariosLista.update((lista) =>
      lista.map((item) => (item.id === id ? { ...item, estado } : item)),
    );
    this.registrar(
      activar ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO',
      'usuario',
      String(id),
      `${usuario.nombre} ${usuario.apellidos} quedó ${activar ? 'activa' : 'inactiva'}.`,
    );
    return {
      ok: true,
      mensaje: activar
        ? 'Cuenta activada en memoria; Flask aplicará el cambio definitivo.'
        : 'Cuenta desactivada en memoria; el historial se conserva.',
    };
  }

  restablecerContrasena(id: number): ResultadoAdmin & { temporal?: string } {
    const usuario = this.usuariosLista().find((item) => item.id === id);
    if (!usuario) {
      return { ok: false, mensaje: 'No encontramos la cuenta indicada.' };
    }
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#@';
    let temporal = 'Tmp-';
    for (let i = 0; i < 8; i += 1) {
      temporal += alfabeto.charAt(Math.floor(Math.random() * alfabeto.length));
    }
    this.registrar(
      'RESTABLECER_CONTRASENA',
      'usuario',
      String(id),
      `Se generó una contraseña temporal de demostración para ${usuario.nombre} ${usuario.apellidos}.`,
    );
    return {
      ok: true,
      temporal,
      mensaje: 'Contraseña temporal generada solo en pantalla: no se guarda ni se envía.',
    };
  }

  guardarEntradaCatalogo(datos: DatosCatalogo, id?: number): ResultadoAdmin {
    const codigo = datos.codigo.trim().toUpperCase();
    const nombre = datos.nombre.trim();
    if (codigo.length === 0 || nombre.length === 0) {
      return { ok: false, mensaje: 'El código y el nombre son obligatorios.' };
    }
    const coincide = (entrada: EntradaCatalogo): boolean =>
      entrada.tipo === datos.tipo &&
      (entrada.codigo.toUpperCase() === codigo ||
        entrada.nombre.toLocaleLowerCase('es-MX') === nombre.toLocaleLowerCase('es-MX')) &&
      entrada.id !== id;
    if (this.catalogosLista().some(coincide)) {
      return { ok: false, mensaje: 'El código o el nombre ya existe en este catálogo.' };
    }

    const original = id === undefined ? undefined : this.catalogosLista().find((item) => item.id === id);
    if (original && this.codigoUsadoEnSku(original.tipo, original.codigo) && original.codigo !== codigo) {
      return {
        ok: false,
        mensaje: 'Ese código ya generó SKU: no se puede cambiar, solo desactivar.',
      };
    }

    const validacionTipo = this.validarPorTipo(datos, id);
    if (!validacionTipo.ok) {
      return validacionTipo;
    }

    const entrada: EntradaCatalogo = {
      id: id ?? this.consecutivoCatalogo++,
      tipo: datos.tipo,
      codigo,
      nombre,
      descripcion: datos.descripcion.trim(),
      activo: datos.activo,
      ...(datos.tipo === 'COLOR' ? { hex: datos.hex.trim() } : {}),
      ...(datos.tipo === 'TALLA' ? { orden: datos.orden ?? 0 } : {}),
      ...(datos.tipo === 'CATEGORIA_PRODUCTO'
        ? { prefijo: datos.prefijo.trim().toUpperCase(), usaTallas: datos.usaTallas }
        : {}),
      ...(datos.tipo === 'CAUSA_MERMA'
        ? {
            aplicaA: datos.aplicaA || 'AMBOS',
            etapaSugerida: datos.etapaSugerida.trim(),
          }
        : {}),
      ...(datos.tipo === 'TARIFA_ENVIO'
        ? {
            cpInicio: datos.cpInicio.trim(),
            cpFin: datos.cpFin.trim(),
            costo: datos.costo ?? 0,
            diasEstimados: datos.diasEstimados ?? 1,
          }
        : {}),
    };

    this.catalogosLista.update((lista) =>
      id === undefined
        ? [entrada, ...lista]
        : lista.map((item) => (item.id === id ? entrada : item)),
    );
    this.registrar(
      id === undefined ? 'ALTA_CATALOGO' : 'ACTUALIZA_CATALOGO',
      'catalogo',
      `${datos.tipo}:${codigo}`,
      `${nombre} en ${datos.tipo}${datos.tipo === 'TARIFA_ENVIO' ? ` (${datos.cpInicio}–${datos.cpFin})` : ''}.`,
    );
    return { ok: true, mensaje: 'Entrada guardada en memoria; Flask validará la clave única.' };
  }

  desactivarEntrada(id: number): ResultadoAdmin {
    const entrada = this.catalogosLista().find((item) => item.id === id);
    if (!entrada) {
      return { ok: false, mensaje: 'No encontramos la entrada indicada.' };
    }
    this.catalogosLista.update((lista) =>
      lista.map((item) => (item.id === id ? { ...item, activo: false } : item)),
    );
    this.registrar(
      'DESACTIVAR_CATALOGO',
      'catalogo',
      `${entrada.tipo}:${entrada.codigo}`,
      `${entrada.nombre} desactivado; el historial y los SKU existentes se conservan.`,
    );
    return { ok: true, mensaje: 'Entrada desactivada en memoria; no se eliminó ningún registro.' };
  }

  guardarParametro(clave: string, valor: number): ResultadoAdmin {
    const parametro = this.parametrosLista().find((item) => item.clave === clave);
    if (!parametro) {
      return { ok: false, mensaje: 'No encontramos el parámetro indicado.' };
    }
    if (!Number.isFinite(valor) || valor < parametro.min || valor > parametro.max) {
      return {
        ok: false,
        mensaje: `${parametro.etiqueta} debe estar entre ${parametro.min} y ${parametro.max} ${parametro.unidad}.`,
      };
    }
    this.parametrosLista.update((lista) =>
      lista.map((item) => (item.clave === clave ? { ...item, valor } : item)),
    );
    this.registrar(
      'ACTUALIZA_PARAMETRO',
      'configuracion',
      clave,
      `${parametro.etiqueta}: ${parametro.valor} → ${valor} ${parametro.unidad}.`,
    );
    return { ok: true, mensaje: `${parametro.etiqueta} actualizado en memoria; Flask aplicará PATCH.` };
  }

  restablecerParametros(): void {
    this.parametrosLista.set(PARAMETROS_INICIALES.map((parametro) => ({ ...parametro })));
    this.registrar(
      'RESTABLECE_PARAMETROS',
      'configuracion',
      null,
      'Parámetros restablecidos a los valores iniciales del documento v3.0.',
    );
  }

  /** Indica si un código ya participa en un SKU generado por M10. */
  codigoUsadoEnSku(tipo: TipoCatalogo, codigo: string): boolean {
    const buscado = codigo.trim().toUpperCase();
    if (tipo === 'COLOR') {
      return this.productos
        .filasVariantes()
        .some((fila) => fila.variante.sku.split('-')[2] === buscado);
    }
    if (tipo === 'TALLA') {
      return this.productos
        .filasVariantes()
        .some((fila) => fila.variante.sku.split('-')[1] === buscado);
    }
    if (tipo === 'CATEGORIA_PRODUCTO') {
      return this.productos
        .productos()
        .some((producto) => producto.codigoSku.toUpperCase() === buscado);
    }
    return false;
  }

  private validarPorTipo(datos: DatosCatalogo, id?: number): ResultadoAdmin {
    if (datos.tipo === 'COLOR' && !/^#[0-9A-Fa-f]{6}$/.test(datos.hex.trim())) {
      return { ok: false, mensaje: 'El color debe tener formato hexadecimal #RRGGBB.' };
    }
    if (datos.tipo === 'TALLA' && (datos.orden === null || datos.orden < 1)) {
      return { ok: false, mensaje: 'El orden de la talla debe ser un entero mayor a cero.' };
    }
    if (datos.tipo === 'CATEGORIA_PRODUCTO' && !/^[A-Z]{2}$/.test(datos.prefijo.trim().toUpperCase())) {
      return { ok: false, mensaje: 'El prefijo del SKU debe tener exactamente dos letras.' };
    }
    if (datos.tipo === 'CAUSA_MERMA' && datos.aplicaA === '') {
      return { ok: false, mensaje: 'Selecciona si la causa aplica a material, producto o ambos.' };
    }
    if (datos.tipo === 'TARIFA_ENVIO') {
      if (!/^\d{5}$/.test(datos.cpInicio) || !/^\d{5}$/.test(datos.cpFin)) {
        return { ok: false, mensaje: 'Los códigos postales deben tener cinco dígitos.' };
      }
      if (datos.cpInicio > datos.cpFin) {
        return { ok: false, mensaje: 'El CP inicial debe ser menor o igual al CP final.' };
      }
      const empalme = this.catalogosLista().some(
        (entrada) =>
          entrada.tipo === 'TARIFA_ENVIO' &&
          entrada.activa &&
          entrada.id !== id &&
          entrada.cpInicio !== undefined &&
          entrada.cpFin !== undefined &&
          datos.cpInicio <= entrada.cpFin &&
          datos.cpFin >= entrada.cpInicio,
      );
      if (empalme) {
        return { ok: false, mensaje: 'El rango de CP se empalma con otra tarifa activa.' };
      }
      if (datos.costo === null || datos.costo < 0) {
        return { ok: false, mensaje: 'El costo de envío debe ser mayor o igual a cero.' };
      }
      if (datos.diasEstimados === null || datos.diasEstimados < 1) {
        return { ok: false, mensaje: 'Los días estimados deben ser un entero mayor a cero.' };
      }
    }
    return { ok: true, mensaje: '' };
  }

  private registrar(
    accion: string,
    entidad: string,
    entidadId: string | null,
    detalle: string,
  ): void {
    this.bitacoraLista.update((lista) => [
      {
        id: this.consecutivoBitacora++,
        fecha: new Date().toISOString(),
        usuario: 'Paola Zamora (demo)',
        accion,
        entidad,
        entidadId,
        detalle,
        ip: '192.168.1.24',
      },
      ...lista,
    ]);
  }
}
