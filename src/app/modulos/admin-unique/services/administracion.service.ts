import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ValorParametro } from '../../../core/api/api.service';
import { ApiAdminService } from './api-admin.service';
import {
  BitacoraRegistro,
  ClienteDetalle,
  ConfiguracionParametro,
  ElementoCatalogo,
  Pagina,
  ParametrosLista,
  RecursoCatalogo,
  UsuarioAdmin,
} from './ui-admin.models';

export interface DatosUsuarioCrear {
  nombre: string;
  apellidos: string;
  correo: string;
  telefono: string;
  password: string;
  rol: 'CLIENTE' | 'OPERATIVO' | 'ADMIN';
  acepta_promociones: boolean;
}

export type DatosUsuarioActualizar = Partial<
  Pick<
    UsuarioAdmin,
    'nombre' | 'apellidos' | 'telefono' | 'rol' | 'estado_cuenta' | 'acepta_promociones'
  >
>;

export type ValorCatalogo = string | number | boolean | null;

export interface CampoCatalogo {
  nombre: string;
  etiqueta: string;
  tipo: 'texto' | 'numero' | 'booleano' | 'select';
  opciones?: { valor: string; etiqueta: string }[];
  soloCreacion?: boolean;
}

export const RECURSOS_CATALOGO: { valor: RecursoCatalogo; etiqueta: string }[] = [
  { valor: 'color', etiqueta: 'Colores' },
  { valor: 'talla', etiqueta: 'Tallas' },
  { valor: 'categoria-producto', etiqueta: 'Categorías de producto' },
  { valor: 'categoria-material', etiqueta: 'Categorías de material' },
  { valor: 'causa-merma', etiqueta: 'Causas de merma' },
  { valor: 'tarifa-envio', etiqueta: 'Tarifas de envío' },
];

export const CAMPOS_CATALOGO: Record<RecursoCatalogo, CampoCatalogo[]> = {
  color: [
    { nombre: 'codigo', etiqueta: 'Código', tipo: 'texto', soloCreacion: true },
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { nombre: 'hex', etiqueta: 'Hexadecimal', tipo: 'texto' },
    { nombre: 'es_comercial', etiqueta: 'Es comercial', tipo: 'booleano' },
  ],
  talla: [
    { nombre: 'codigo', etiqueta: 'Código', tipo: 'texto', soloCreacion: true },
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { nombre: 'orden', etiqueta: 'Orden', tipo: 'numero' },
  ],
  'categoria-producto': [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { nombre: 'prefijo_sku', etiqueta: 'Prefijo SKU', tipo: 'texto', soloCreacion: true },
    { nombre: 'usa_tallas', etiqueta: 'Usa tallas', tipo: 'booleano' },
    { nombre: 'activa', etiqueta: 'Activa', tipo: 'booleano' },
  ],
  'categoria-material': [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto' },
  ],
  'causa-merma': [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    {
      nombre: 'aplica_a',
      etiqueta: 'Aplica a',
      tipo: 'select',
      opciones: [
        { valor: 'MATERIAL', etiqueta: 'Material' },
        { valor: 'PRODUCTO', etiqueta: 'Producto' },
        { valor: 'AMBOS', etiqueta: 'Ambos' },
      ],
    },
    { nombre: 'etapa_sugerida', etiqueta: 'Etapa sugerida', tipo: 'texto' },
    { nombre: 'activa', etiqueta: 'Activa', tipo: 'booleano' },
  ],
  'tarifa-envio': [
    { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto' },
    { nombre: 'cp_inicio', etiqueta: 'CP inicial', tipo: 'texto' },
    { nombre: 'cp_fin', etiqueta: 'CP final', tipo: 'texto' },
    { nombre: 'costo', etiqueta: 'Costo', tipo: 'texto' },
    { nombre: 'dias_estimados', etiqueta: 'Días estimados', tipo: 'numero' },
    { nombre: 'activa', etiqueta: 'Activa', tipo: 'booleano' },
  ],
};

/** M22: única puerta HTTP de usuarios, clientes, catálogos, configuración y bitácora. */
@Injectable({ providedIn: 'root' })
export class AdministracionService {
  private readonly api = inject(ApiAdminService);

  listarUsuarios(parametros: ParametrosLista = {}): Observable<Pagina<UsuarioAdmin>> {
    return this.api.get<Pagina<UsuarioAdmin>>('/usuarios', { ...parametros });
  }

  crearUsuario(datos: DatosUsuarioCrear): Observable<UsuarioAdmin> {
    return this.api.post<UsuarioAdmin>('/usuarios', datos);
  }

  obtenerUsuario(id: number): Observable<UsuarioAdmin> {
    return this.api.get<UsuarioAdmin>(`/usuarios/${id}`);
  }

  actualizarUsuario(id: number, datos: DatosUsuarioActualizar): Observable<UsuarioAdmin> {
    return this.api.patch<UsuarioAdmin>(`/usuarios/${id}`, datos);
  }

  desactivarUsuario(id: number): Observable<void> {
    return this.api.delete<void>(`/usuarios/${id}`);
  }

  listarClientes(parametros: ParametrosLista = {}): Observable<Pagina<UsuarioAdmin>> {
    return this.api.get<Pagina<UsuarioAdmin>>('/clientes', { ...parametros });
  }

  obtenerCliente(id: number): Observable<ClienteDetalle> {
    return this.api.get<ClienteDetalle>(`/clientes/${id}`);
  }

  listarCatalogo(
    recurso: RecursoCatalogo,
    filtros: { q?: string; activa?: boolean } & ParametrosLista = {},
  ): Observable<Pagina<ElementoCatalogo>> {
    return this.api.get<Pagina<ElementoCatalogo>>(`/catalogos/${recurso}`, { ...filtros });
  }

  crearCatalogo(
    recurso: RecursoCatalogo,
    datos: Record<string, ValorCatalogo>,
  ): Observable<ElementoCatalogo> {
    return this.api.post<ElementoCatalogo>(`/catalogos/${recurso}`, datos);
  }

  actualizarCatalogo(
    recurso: RecursoCatalogo,
    id: number,
    datos: Record<string, ValorCatalogo>,
  ): Observable<ElementoCatalogo> {
    return this.api.patch<ElementoCatalogo>(`/catalogos/${recurso}/${id}`, datos);
  }

  eliminarCatalogo(recurso: RecursoCatalogo, id: number): Observable<void> {
    return this.api.delete<void>(`/catalogos/${recurso}/${id}`);
  }

  listarConfiguracion(): Observable<ConfiguracionParametro[]> {
    return this.api.get<ConfiguracionParametro[]>('/configuracion');
  }

  actualizarConfiguracion(valores: Record<string, string | number>): Observable<Record<string, string>> {
    return this.api.patch<Record<string, string>>('/configuracion', { valores });
  }

  listarBitacora(
    filtros: {
      accion?: string;
      entidad?: string;
      usuario_id?: number;
      desde?: string;
      hasta?: string;
    } & ParametrosLista = {},
  ): Observable<Pagina<BitacoraRegistro>> {
    const params: Record<string, ValorParametro> = { ...filtros };
    return this.api.get<Pagina<BitacoraRegistro>>('/bitacora', params);
  }
}
