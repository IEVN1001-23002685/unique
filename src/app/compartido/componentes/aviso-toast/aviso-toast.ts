import { Component, inject } from '@angular/core';
import { AvisosServicio } from '../../../nucleo/servicios/avisos-servicio';

@Component({
  selector: 'app-aviso-toast',
  templateUrl: './aviso-toast.html',
  styleUrl: './aviso-toast.css',
})
export class AvisoToast {
  protected readonly avisos = inject(AvisosServicio);
}
