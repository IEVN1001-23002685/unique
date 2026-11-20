import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-desplegable-categorias',
  styleUrl: './desplegable-categorias.css',
  templateUrl: './desplegable-categorias.html',
})
export class DesplegableCategorias {
  readonly categorias = input.required<string[]>();
  readonly seleccionada = input<string | null>(null);
  readonly seleccionar = output<string | null>();
  protected readonly abierto = signal(false);

  private readonly contenedor: ElementRef<HTMLElement> = inject(ElementRef);

  alternar(): void {
    this.abierto.update((abierto) => !abierto);
  }

  elegir(categoria: string | null): void {
    this.seleccionar.emit(categoria);
    this.abierto.set(false);
  }

  @HostListener('document:click', ['$event'])
  cerrarSiEsExterior(evento: MouseEvent): void {
    const objetivo = evento.target as Node | null;
    if (objetivo && !this.contenedor.nativeElement.contains(objetivo)) {
      this.abierto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  cerrarPorTeclado(): void {
    this.abierto.set(false);
  }
}
