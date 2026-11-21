import { CurrencyPipe } from '@angular/common';
import { Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { IProducto } from '../../../nucleo/modelos/producto';

@Component({
  imports: [CurrencyPipe, RouterLink],
  selector: 'app-tarjeta-producto',
  styleUrl: './tarjeta-producto.css',
  templateUrl: './tarjeta-producto.html',
})
export class TarjetaProducto {
  readonly producto = input.required<IProducto>();
  protected readonly imagenNoDisponible = signal(false);
}
