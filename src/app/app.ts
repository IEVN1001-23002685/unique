import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModalAutenticacion } from './compartido/componentes/modal-autenticacion/modal-autenticacion';
import { ApiConfigService } from './core/api/api-config.service';

@Component({
  imports: [RouterOutlet, ModalAutenticacion],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly config = inject(ApiConfigService);
}
