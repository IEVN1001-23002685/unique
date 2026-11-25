import { Component, computed, inject, signal } from '@angular/core';
import { AvisosServicio } from '../../../../nucleo/servicios/avisos-servicio';
import { NavegacionProductos } from '../../componentes/navegacion-productos/navegacion-productos';
import type { CodigoColor, RecursoImagen } from '../../modelos/producto-maestro';
import { ImagenesServicio } from '../../servicios/imagenes-servicio';
import { ProductosServicio } from '../../servicios/productos-servicio';

type DestinoImagen = 'Producto' | 'Categoría' | 'Material' | 'Bordado' | 'Nuevas';

/** Biblioteca de imágenes reales + carga local con previsualización (sin persistencia). */
@Component({
  selector: 'app-imagenes',
  imports: [NavegacionProductos],
  templateUrl: './imagenes.html',
  styleUrl: './imagenes.css',
})
export class Imagenes {
  protected readonly productosServicio = inject(ProductosServicio);
  protected readonly imagenesServicio = inject(ImagenesServicio);
  private readonly avisos = inject(AvisosServicio);

  protected readonly productos = this.productosServicio.productos;
  protected readonly colores = this.productosServicio.colores;
  protected readonly biblioteca = this.imagenesServicio.biblioteca;
  protected readonly fallidos = signal<ReadonlySet<string>>(new Set<string>());

  protected readonly destinos: readonly DestinoImagen[] = [
    'Producto',
    'Categoría',
    'Material',
    'Bordado',
    'Nuevas',
  ];
  protected readonly destino = signal<DestinoImagen>('Producto');
  protected readonly categoriaFiltro = signal('TODAS');
  protected readonly categorias = computed(() => [
    'TODAS',
    ...new Set(this.biblioteca().map((recurso) => recurso.categoria)),
  ]);

  protected readonly seleccionada = signal<RecursoImagen | null>(null);
  protected readonly productoId = signal('');
  protected readonly color = signal<'' | CodigoColor>('');
  protected readonly etiquetaCarga = signal('');
  protected readonly vistaPrevia = signal('');
  protected readonly errorArchivo = signal('');

  protected readonly visibles = computed(() => {
    const filtro = this.categoriaFiltro();
    return this.biblioteca().filter(
      (recurso) => filtro === 'TODAS' || recurso.categoria === filtro,
    );
  });

  protected alFiltrar(evento: Event): void {
    this.categoriaFiltro.set((evento.target as HTMLSelectElement).value);
  }

  protected alCambiarEtiqueta(evento: Event): void {
    this.etiquetaCarga.set((evento.target as HTMLInputElement).value);
  }

  protected alCambiarDestino(evento: Event): void {
    this.destino.set((evento.target as HTMLSelectElement).value as DestinoImagen);
  }

  protected alCambiarProducto(evento: Event): void {
    this.productoId.set((evento.target as HTMLSelectElement).value);
  }

  protected alCambiarColor(evento: Event): void {
    this.color.set((evento.target as HTMLSelectElement).value as '' | CodigoColor);
  }

  protected seleccionar(recurso: RecursoImagen): void {
    this.seleccionada.set(recurso);
  }

  protected imagenVisible(recurso: RecursoImagen): boolean {
    return !this.fallidos().has(recurso.url);
  }

  protected marcarFallido(url: string): void {
    const siguiente = new Set(this.fallidos());
    siguiente.add(url);
    this.fallidos.set(siguiente);
  }

  protected alSeleccionarArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    this.errorArchivo.set('');
    this.vistaPrevia.set('');
    if (!archivo) {
      return;
    }

    const error = this.imagenesServicio.validarArchivo(archivo);
    if (error !== null) {
      this.errorArchivo.set(error);
      this.avisos.mostrar('error', error);
      entrada.value = '';
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      if (typeof lector.result === 'string') {
        this.vistaPrevia.set(lector.result);
        this.etiquetaCarga.set(archivo.name.replace(/\.[^.]+$/, ''));
      }
    };
    lector.onerror = () => {
      this.errorArchivo.set('No fue posible leer la imagen. Intenta con otro archivo.');
    };
    lector.readAsDataURL(archivo);
  }

  protected agregarCarga(): void {
    if (this.vistaPrevia() === '') {
      this.avisos.mostrar('advertencia', 'Selecciona una imagen válida antes de agregarla.');
      return;
    }
    this.imagenesServicio.registrar(
      this.vistaPrevia(),
      this.etiquetaCarga() || 'Imagen cargada',
      'Carga local',
    );
    this.avisos.mostrar(
      'exito',
      'Imagen agregada a la biblioteca de demostración. No se guarda en servidor.',
    );
    this.vistaPrevia.set('');
    this.categoriaFiltro.set('TODAS');
  }

  protected asignar(): void {
    const recurso = this.seleccionada();
    const id = Number(this.productoId());
    if (!recurso || !Number.isInteger(id) || id <= 0) {
      this.avisos.mostrar('error', 'Elige una imagen y un producto válidos.');
      return;
    }

    const resultado = this.productosServicio.asignarImagen(
      id,
      this.color() === '' ? null : this.color(),
      recurso.url,
    );
    this.avisos.mostrar(resultado.ok ? 'exito' : 'error', resultado.mensaje);
  }
}
