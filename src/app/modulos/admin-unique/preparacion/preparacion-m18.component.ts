import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { mensajeError } from '../../../core/api/errores';
import { AuthSessionService } from '../services/auth-session.service';
import { abrirPdf } from '../services/descargas';
import { PreparacionService } from '../services/preparacion.service';
import {
  IncidenciaPreparacion,
  Preparacion,
  PreparacionLinea,
  TipoIncidencia,
} from '../services/ui-admin.models';

interface VistaPreparacion extends Preparacion {
  cliente: string;
  fecha_prometida: string | null;
}

interface IncidenciaVista {
  folio: string;
  pedidoId: number;
  sku: string;
  producto: string;
  descripcion: string;
}

@Component({
  selector: 'app-preparacion-m18',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './preparacion-m18.component.html',
  styleUrl: './modulos-admin.css',
})
export class PreparacionM18Component implements OnInit {
  private readonly servicio = inject(PreparacionService);
  private readonly auth = inject(AuthSessionService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  pestana: 'cola' | 'incidencias' = 'cola';
  pedidos: VistaPreparacion[] = [];
  seleccionado: VistaPreparacion | null = null;
  cargando = true;
  error = '';
  aviso = '';
  filtro = '';
  estado = '';
  pagina = 1;
  porPagina = 20;
  total = 0;
  incidencia: {
    preparacion_linea_id: number | null;
    tipo: TipoIncidencia;
    descripcion: string;
    cantidad: number | null;
  } = {
    preparacion_linea_id: null,
    tipo: 'SKU',
    descripcion: '',
    cantidad: null,
  };

  /** Flask aplica herencia ADMIN → OPERATIVO en `roles_requeridos`. */
  get puedeOperar(): boolean {
    const rol = this.auth.usuario?.rol;
    return rol === 'OPERATIVO' || rol === 'ADMIN';
  }

  /** El filtro estricto de Flask impide enviar paginación en este endpoint. */
  get totalPaginas(): number {
    return 1;
  }

  get incidencias(): IncidenciaVista[] {
    return this.pedidos.flatMap((p) =>
      p.lineas
        .filter((linea) => !!linea.incidencia)
        .map((linea) => ({
          folio: p.folio || `Pedido #${p.pedido_id}`,
          pedidoId: p.pedido_id,
          sku: linea.sku || 'SKU no capturado',
          producto: linea.nombre_producto || 'Producto',
          descripcion: linea.incidencia ?? '',
        })),
    );
  }

  ngOnInit(): void {
    this.ruta.paramMap.subscribe((params) => {
      this.pestana = params.get('seccion') === 'incidencias' ? 'incidencias' : 'cola';
      this.seleccionado = null;
      this.error = '';
      this.aviso = '';
      this.cargar();
    });
  }

  cambiarPestana(pestana: 'cola' | 'incidencias'): void {
    this.pestana = pestana;
    this.error = '';
    this.aviso = '';
    void this.router.navigate(
      pestana === 'incidencias' ? ['/panel-admin/preparacion/incidencias'] : ['/panel-admin/preparacion'],
    );
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.servicio.cola(this.estado || undefined).subscribe({
      next: (respuesta) => {
        this.pedidos = respuesta.items.map((item) => this.comoVista(item));
        this.total = respuesta.total;
        this.pagina = respuesta.pagina;
        this.porPagina = respuesta.por_pagina;
        this.cargando = false;
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No fue posible cargar la cola de preparación.');
        this.cargando = false;
      },
    });
  }

  cambiarPagina(_delta: number): void {
    // El backend no acepta `pagina`/`por_pagina` en este filtro; se mantiene la primera página.
  }

  get filtrados(): VistaPreparacion[] {
    const texto = this.filtro.trim().toLowerCase();
    if (!texto) return this.pedidos;
    return this.pedidos.filter((p) =>
      `${p.folio ?? ''} ${p.cliente} ${p.estado}`.toLowerCase().includes(texto),
    );
  }

  tomar(p: VistaPreparacion): void {
    if (!this.puedeOperar) return;
    this.error = '';
    this.servicio.tomar(p.pedido_id).subscribe({
      next: (respuesta) => {
        this.seleccionado = this.comoVista(respuesta);
        this.aviso = 'Pedido tomado. La preparación está en picking.';
        this.cargar();
      },
      error: (error: unknown) => (this.error = mensajeError(error, 'No se pudo tomar el pedido.')),
    });
  }

  abrir(p: VistaPreparacion): void {
    this.pestana = 'cola';
    this.seleccionado = p;
    this.aviso = '';
    this.error = '';
    this.incidencia.preparacion_linea_id = p.lineas[0]?.id ?? null;
  }

  cerrar(): void {
    this.seleccionado = null;
  }

  cambiarSurtido(linea: PreparacionLinea, valor: string): void {
    if (!this.seleccionado || !this.puedeOperar) return;
    const cantidad = Number(valor);
    if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > linea.cantidad_requerida) {
      this.error = 'La cantidad surtida debe ser un entero entre 0 y la cantidad requerida.';
      return;
    }
    const anterior = linea.cantidad_surtida;
    linea.cantidad_surtida = cantidad;
    this.actualizarLinea(linea, { cantidad_surtida: cantidad }, () => {
      linea.cantidad_surtida = anterior;
    });
  }

  cambiarVerificacion(
    linea: PreparacionLinea,
    campo: 'sku_verificado' | 'diseno_verificado' | 'etiquetas_verificadas',
    valor: boolean,
  ): void {
    if (!this.seleccionado || !this.puedeOperar) return;
    const anterior = linea[campo];
    linea[campo] = valor;
    this.actualizarLinea(linea, { [campo]: valor }, () => {
      linea[campo] = anterior;
    });
  }

  private actualizarLinea(
    linea: PreparacionLinea,
    cambio: Record<string, number | boolean>,
    revertir: () => void,
  ): void {
    const id = this.seleccionado?.id;
    if (!id) return;
    this.error = '';
    this.servicio
      .actualizarLineas(id, [{ preparacion_linea_id: linea.id, ...cambio }])
      .subscribe({
        next: (respuesta) => {
          this.seleccionado = this.comoVista(respuesta);
        },
        error: (error: unknown) => {
          revertir();
          this.error = mensajeError(error, 'No se pudo guardar la línea de preparación.');
        },
      });
  }

  get listoEmpaque(): boolean {
    const lineas = this.seleccionado?.lineas ?? [];
    return (
      lineas.length > 0 &&
      lineas.every(
        (l) =>
          l.sku_verificado &&
          l.diseno_verificado &&
          l.etiquetas_verificadas &&
          l.cantidad_surtida >= l.cantidad_requerida,
      )
    );
  }

  empacar(): void {
    if (!this.seleccionado || !this.listoEmpaque || !this.puedeOperar) return;
    this.error = '';
    this.servicio.empacar(this.seleccionado.id).subscribe({
      next: () => {
        this.aviso = 'Preparación empacada. El pedido pasó a LISTO_ENVIO.';
        this.seleccionado = null;
        this.cargar();
      },
      error: (error: unknown) => (this.error = mensajeError(error, 'No se pudo empacar.')),
    });
  }

  imprimirEtiqueta(): void {
    if (!this.seleccionado) return;
    this.error = '';
    this.servicio.etiqueta(this.seleccionado.id).subscribe({
      next: (pdf) => abrirPdf(pdf),
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo generar la etiqueta.');
      },
    });
  }

  registrarIncidencia(): void {
    if (!this.seleccionado || !this.puedeOperar) return;
    const lineaId = this.incidencia.preparacion_linea_id;
    if (!lineaId || this.incidencia.descripcion.trim().length < 3) {
      this.error = 'Selecciona una línea y describe la incidencia (mínimo 3 caracteres).';
      return;
    }
    const datos: IncidenciaPreparacion = {
      preparacion_linea_id: lineaId,
      tipo: this.incidencia.tipo,
      descripcion: this.incidencia.descripcion.trim(),
    };
    if (this.incidencia.tipo === 'CALIDAD') {
      datos.cantidad = Math.max(1, Number(this.incidencia.cantidad) || 1);
    }
    this.error = '';
    this.servicio.registrarIncidencia(this.seleccionado.id, datos).subscribe({
      next: (respuesta) => {
        this.seleccionado = this.comoVista(respuesta);
        this.incidencia.descripcion = '';
        this.incidencia.cantidad = null;
        this.aviso = 'Incidencia registrada.';
        this.cargar();
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo registrar la incidencia.');
      },
    });
  }

  private comoVista(preparacion: Preparacion): VistaPreparacion {
    return {
      ...preparacion,
      cliente: preparacion.destinatario ?? `Pedido #${preparacion.pedido_id}`,
      fecha_prometida: preparacion.fecha_promesa,
    };
  }
}
