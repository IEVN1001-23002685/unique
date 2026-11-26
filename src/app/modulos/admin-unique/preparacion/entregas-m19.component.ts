import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { mensajeError } from '../../../core/api/errores';
import { AuthSessionService } from '../services/auth-session.service';
import { abrirPdf } from '../services/descargas';
import { EntregasService } from '../services/entregas.service';
import {
  Entrega,
  FilaEntrega,
  PedidoPorAsignar,
  ProductoRepartido,
  Repartidor,
} from '../services/ui-admin.models';

type Pestana = 'asignar' | 'hoja' | 'seguimiento' | 'productos' | 'repartidores';

@Component({
  selector: 'app-entregas-m19',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './entregas-m19.component.html',
  styleUrl: './modulos-admin.css',
})
export class EntregasM19Component implements OnInit {
  private readonly servicio = inject(EntregasService);
  private readonly auth = inject(AuthSessionService);
  private readonly fb = inject(FormBuilder);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  pestana: Pestana = 'asignar';
  porAsignar: PedidoPorAsignar[] = [];
  seguimiento: Entrega[] = [];
  productos: ProductoRepartido[] = [];
  repartidores: Repartidor[] = [];
  cargando = true;
  cargandoRepartidores = false;
  error = '';
  aviso = '';
  filtro = '';
  codigoPostal = '';
  ordenCP: 'CP' | 'PRIORIDAD' | 'FECHA' = 'CP';
  filtroRepartidor = '';
  seguimientoFiltro = { estado: '', desde: '', hasta: '' };
  pagina = 1;
  porPagina = 20;
  total = 0;
  asignacion = {
    repartidor_id: null as number | null,
    repartidor_manual: null as number | null,
    fecha_programada: this.hoy(),
    notas: '',
  };
  hoja = {
    repartidor: null as number | null,
    repartidor_manual: null as number | null,
    fecha: this.hoy(),
  };
  reporte = {
    repartidor: null as number | null,
    repartidor_manual: null as number | null,
    desde: '',
    hasta: '',
  };
  resultado: {
    entrega: Entrega | null;
    entregado: boolean;
    receptor: string;
    motivo_fallo: string;
    notas: string;
  } = { entrega: null, entregado: true, receptor: '', motivo_fallo: 'OTRO', notas: '' };

  editando: number | null = null;
  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    vehiculo: ['', [Validators.maxLength(60)]],
    activo: [true],
  });

  get esAdmin(): boolean {
    return this.auth.usuario?.rol === 'ADMIN';
  }

  get puedeOperar(): boolean {
    const rol = this.auth.usuario?.rol;
    return rol === 'OPERATIVO' || rol === 'ADMIN';
  }

  /** Los filtros estrictos de Flask no aceptan paginación en estos listados. */
  get totalPaginas(): number {
    return 1;
  }

  get repartidoresActivos(): number {
    return this.repartidores.filter((r) => r.activo).length;
  }

  get repartidorAsignacion(): number | null {
    return this.esAdmin ? this.asignacion.repartidor_id : this.asignacion.repartidor_manual;
  }

  get repartidorHoja(): number | null {
    return this.esAdmin ? this.hoja.repartidor : this.hoja.repartidor_manual;
  }

  get repartidorReporte(): number | null {
    return this.esAdmin ? this.reporte.repartidor : this.reporte.repartidor_manual;
  }

  ngOnInit(): void {
    const secciones: Record<string, Pestana> = {
      'por-asignar': 'asignar',
      asignar: 'asignar',
      'hoja-reparto': 'hoja',
      hoja: 'hoja',
      seguimiento: 'seguimiento',
      'productos-repartidos': 'productos',
      productos: 'productos',
      repartidores: 'repartidores',
    };
    this.ruta.paramMap.subscribe((params) => {
      this.pestana = secciones[params.get('seccion') ?? ''] ?? 'asignar';
      if (this.pestana === 'repartidores' && !this.esAdmin) this.pestana = 'asignar';
      this.error = '';
      this.aviso = '';
      this.cargar();
      if (this.esAdmin && this.pestana !== 'repartidores') this.cargarRepartidores();
    });
  }

  private hoy(): string {
    const fecha = new Date();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  /** §10: fechaNoPasada para M19; las fechas ISO se comparan como texto. */
  private esFechaValida(fecha: string): boolean {
    return !!fecha && fecha >= this.hoy();
  }

  cargar(): void {
    if (this.pestana === 'repartidores') {
      this.cargarRepartidores();
      return;
    }
    this.cargando = true;
    this.error = '';
    if (this.pestana === 'asignar') {
      if (this.codigoPostal && !/^\d{5}$/.test(this.codigoPostal)) {
        this.error = 'El código postal debe tener 5 dígitos.';
        this.cargando = false;
        return;
      }
      this.servicio
        .porAsignar({ codigo_postal: this.codigoPostal })
        .subscribe({
          next: (respuesta) => {
            this.porAsignar = respuesta.items;
            this.total = respuesta.total;
            this.pagina = respuesta.pagina;
            this.porPagina = respuesta.por_pagina;
            this.cargando = false;
          },
          error: (error: unknown) => {
            this.error = mensajeError(error, 'No fue posible cargar los pedidos por asignar.');
            this.cargando = false;
          },
        });
      return;
    }
    if (this.pestana === 'productos') {
      this.servicio
        .productosRepartidos({
          repartidor: this.repartidorReporte ?? undefined,
          desde: this.reporte.desde || undefined,
          hasta: this.reporte.hasta || undefined,
        })
        .subscribe({
          next: (respuesta) => {
            this.productos = respuesta.items;
            this.total = respuesta.total;
            this.pagina = respuesta.pagina;
            this.porPagina = respuesta.por_pagina;
            this.cargando = false;
          },
          error: (error: unknown) => {
            this.error = mensajeError(error, 'No fue posible cargar los productos repartidos.');
            this.cargando = false;
          },
        });
      return;
    }
    this.total = this.seguimiento.length;
    this.cargando = false;
  }

  cargarRepartidores(): void {
    this.cargandoRepartidores = true;
    this.error = '';
    this.servicio.listarRepartidores().subscribe({
      next: (respuesta) => {
        this.repartidores = respuesta.items;
        this.total = respuesta.total;
        this.pagina = respuesta.pagina;
        this.porPagina = respuesta.por_pagina;
        this.cargandoRepartidores = false;
      },
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo cargar el catálogo de repartidores.');
        this.cargandoRepartidores = false;
      },
    });
  }

  cambiarTab(pestana: Pestana): void {
    this.pestana = pestana;
    this.pagina = 1;
    this.filtro = '';
    this.error = '';
    this.aviso = '';
    const secciones: Record<Pestana, string> = {
      asignar: 'por-asignar',
      hoja: 'hoja-reparto',
      seguimiento: 'seguimiento',
      productos: 'productos-repartidos',
      repartidores: 'repartidores',
    };
    void this.router.navigate(['/panel-admin/entregas', secciones[pestana]]);
  }

  cambiarPagina(delta: number): void {
    const destino = this.pagina + delta;
    if (destino < 1 || destino > this.totalPaginas) return;
    this.pagina = destino;
    this.cargar();
  }

  get filas(): FilaEntrega[] {
    if (this.pestana === 'asignar') return this.porAsignar.map((p) => this.filaPorAsignar(p));
    if (this.pestana === 'seguimiento') return this.seguimiento.map((e) => this.filaEntrega(e));
    return [];
  }

  get filtradas(): FilaEntrega[] {
    const texto = this.filtro.trim().toLowerCase();
    let lista = texto
      ? this.filas.filter((f) =>
          `${f.folio} ${f.pedido} ${f.destinatario} ${f.codigo_postal} ${f.repartidor}`
            .toLowerCase()
            .includes(texto),
        )
      : [...this.filas];

    if (this.pestana === 'asignar') {
      // §7: ordenar por CP permite agrupar paradas de una misma ruta.
      if (this.ordenCP === 'CP') {
        lista.sort(
          (a, b) =>
            a.codigo_postal.localeCompare(b.codigo_postal) ||
            a.fecha_programada.localeCompare(b.fecha_programada),
        );
      } else if (this.ordenCP === 'PRIORIDAD') {
        const peso = (f: FilaEntrega): number => (f.detalle === 'ALTA' ? 0 : 1);
        lista.sort(
          (a, b) =>
            peso(a) - peso(b) ||
            a.fecha_programada.localeCompare(b.fecha_programada) ||
            a.codigo_postal.localeCompare(b.codigo_postal),
        );
      } else {
        lista.sort(
          (a, b) =>
            a.fecha_programada.localeCompare(b.fecha_programada) ||
            a.codigo_postal.localeCompare(b.codigo_postal),
        );
      }
      return lista;
    }

    if (this.pestana === 'seguimiento') {
      const repartidor = this.filtroRepartidor.trim().toLowerCase();
      const { estado, desde, hasta } = this.seguimientoFiltro;
      lista = lista.filter((f) => {
        if (estado && f.estado !== estado) return false;
        const fecha = (
          f.entrega_origen?.salida_en ??
          f.entrega_origen?.resultado_en ??
          f.fecha_programada ??
          ''
        ).slice(0, 10);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
        if (repartidor && !f.repartidor.toLowerCase().includes(repartidor)) return false;
        return true;
      });
    }
    return lista;
  }

  private filaPorAsignar(p: PedidoPorAsignar): FilaEntrega {
    return {
      id: null,
      folio: p.venta_folio,
      pedido: `Pedido #${p.pedido_id}`,
      destinatario: p.direccion?.destinatario ?? '—',
      direccion: p.direccion?.direccion ?? '—',
      codigo_postal: p.direccion?.codigo_postal ?? '',
      telefono: p.direccion?.telefono ?? '',
      repartidor: 'Sin asignar',
      estado: 'POR ASIGNAR',
      intento: 0,
      fecha_programada: p.fecha_promesa ?? '',
      detalle: p.prioridad ?? '',
      pedido_origen: p,
    };
  }

  private filaEntrega(e: Entrega): FilaEntrega {
    return {
      id: e.id,
      folio: e.folio,
      pedido: `Pedido #${e.pedido_id}`,
      destinatario: e.destinatario ?? '—',
      direccion: e.direccion ?? '—',
      codigo_postal: e.codigo_postal ?? '',
      telefono: e.telefono ?? '',
      repartidor: e.repartidor ?? `Repartidor #${e.repartidor_id}`,
      estado: e.estado,
      intento: e.intento,
      fecha_programada: e.fecha_programada,
      detalle: e.notas ?? e.motivo_fallo ?? '',
      entrega_origen: e,
    };
  }

  asignarFila(f: FilaEntrega): void {
    if (f.pedido_origen) this.asignar(f.pedido_origen);
  }

  confirmarSalidaFila(f: FilaEntrega): void {
    if (f.entrega_origen) this.confirmarSalida(f.entrega_origen);
  }

  seleccionarResultadoFila(f: FilaEntrega, entregado: boolean): void {
    if (f.entrega_origen) this.seleccionarResultado(f.entrega_origen, entregado);
  }

  asignar(p: PedidoPorAsignar): void {
    if (!this.puedeOperar) return;
    const repartidor = this.repartidorAsignacion;
    if (!repartidor || !this.asignacion.fecha_programada) {
      this.error = 'Indica un repartidor y una fecha programada.';
      return;
    }
    if (!this.esFechaValida(this.asignacion.fecha_programada)) {
      this.error = 'La fecha programada debe ser igual o posterior a hoy.';
      return;
    }
    this.error = '';
    this.servicio
      .asignar({
        pedido_id: p.pedido_id,
        repartidor_id: repartidor,
        fecha_programada: this.asignacion.fecha_programada,
        notas: this.asignacion.notas || undefined,
      })
      .subscribe({
        next: (entrega) => {
          this.seguimiento = [entrega, ...this.seguimiento.filter((e) => e.id !== entrega.id)];
          this.aviso = `Entrega ${entrega.folio} asignada. Esa guía es la que verá el cliente en M06.`;
          this.cargar();
        },
        error: (error: unknown) => (this.error = mensajeError(error, 'No se pudo asignar la entrega.')),
      });
  }

  confirmarSalida(e: Entrega): void {
    if (!this.puedeOperar) return;
    this.error = '';
    this.servicio.salida(e.id).subscribe({
      next: (actualizada) => {
        this.reemplazar(actualizada);
        this.aviso = `Salida de ${actualizada.folio} confirmada: el pedido pasa a EN_REPARTO y Flask descuenta la existencia (M12).`;
      },
      error: (error: unknown) => (this.error = mensajeError(error, 'No se pudo confirmar la salida.')),
    });
  }

  seleccionarResultado(e: Entrega, entregado: boolean): void {
    this.resultado = {
      entrega: e,
      entregado,
      receptor: entregado ? e.destinatario ?? '' : '',
      motivo_fallo: 'OTRO',
      notas: '',
    };
    this.error = '';
  }

  registrarResultado(): void {
    const entrega = this.resultado.entrega;
    if (!entrega || !this.puedeOperar) return;
    if (this.resultado.entregado && !this.resultado.receptor.trim()) {
      this.error = 'Indica quién recibió el pedido.';
      return;
    }
    this.error = '';
    this.servicio
      .resultado(entrega.id, {
        entregado: this.resultado.entregado,
        receptor: this.resultado.entregado ? this.resultado.receptor.trim() : null,
        motivo_fallo: this.resultado.entregado ? null : this.resultado.motivo_fallo,
        notas: this.resultado.notas || null,
      })
      .subscribe({
        next: (actualizada) => {
          this.reemplazar(actualizada);
          this.resultado.entrega = null;
          this.aviso = this.resultado.entregado
            ? 'Entrega registrada como ENTREGADA: se guarda la hora y se abre la ventana de devolución (M07).'
            : 'Fallo registrado: las prendas se reingresan conservando su reserva y el pedido vuelve a LISTO_ENVIO para un nuevo intento.';
        },
        error: (error: unknown) => (this.error = mensajeError(error, 'No se pudo registrar el resultado.')),
      });
  }

  private reemplazar(entrega: Entrega): void {
    this.seguimiento = this.seguimiento.map((e) => (e.id === entrega.id ? entrega : e));
    this.total = this.seguimiento.length;
  }

  generarHoja(): void {
    const repartidor = this.repartidorHoja;
    if (!repartidor || !this.hoja.fecha) {
      this.error = 'Indica repartidor y fecha para la hoja de reparto.';
      return;
    }
    if (!this.esFechaValida(this.hoja.fecha)) {
      this.error = 'La fecha de la hoja debe ser igual o posterior a hoy.';
      return;
    }
    this.error = '';
    this.servicio.hojaReparto(repartidor, this.hoja.fecha).subscribe({
      next: (pdf) => abrirPdf(pdf),
      error: (error: unknown) => {
        this.error = mensajeError(error, 'No se pudo generar la hoja de reparto.');
      },
    });
  }

  guardarRepartidor(): void {
    if (!this.esAdmin || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valores = this.form.getRawValue();
    const peticion: Observable<unknown> = this.editando
      ? this.servicio.actualizarRepartidor(this.editando, {
          nombre: valores.nombre ?? undefined,
          telefono: valores.telefono ?? undefined,
          vehiculo: valores.vehiculo ?? undefined,
          activo: valores.activo ?? undefined,
        })
      : this.servicio.crearRepartidor({
          nombre: valores.nombre ?? '',
          telefono: valores.telefono ?? '',
          vehiculo: valores.vehiculo || null,
        });
    peticion.subscribe({
      next: () => {
        this.aviso = 'Repartidor guardado.';
        this.form.reset({ activo: true });
        this.editando = null;
        this.cargarRepartidores();
      },
      error: (error: unknown) => (this.error = mensajeError(error, 'No se pudo guardar el repartidor.')),
    });
  }

  editar(r: Repartidor): void {
    this.editando = r.id;
    this.form.patchValue(r);
  }

  desactivar(r: Repartidor): void {
    if (!this.esAdmin || !confirm(`¿Desactivar a ${r.nombre}?`)) return;
    this.servicio.desactivarRepartidor(r.id).subscribe({
      next: () => {
        this.aviso = 'Repartidor desactivado.';
        this.cargarRepartidores();
      },
      error: (error: unknown) => (this.error = mensajeError(error, 'No se pudo desactivar.')),
    });
  }
}
