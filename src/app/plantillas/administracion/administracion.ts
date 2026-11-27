import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AvisoToast } from '../../compartido/componentes/aviso-toast/aviso-toast';
import { PerfilSesionServicio, type PerfilSesion } from '../../nucleo/servicios/perfil-sesion-servicio';

interface EnlacePanel {
  etiqueta: string;
  ruta: string;
  roles: PerfilSesion[];
}

interface GrupoPanel {
  titulo: string;
  enlaces: EnlacePanel[];
}

/**
 * Bandera superior del panel administrativo. La navegación se agrupa por
 * responsabilidad y se filtra por el rol real de la sesión (§3 y §10).
 */
@Component({
  selector: 'app-administracion',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AvisoToast],
  templateUrl: './administracion.html',
  styleUrl: './administracion.css',
})
export class Administracion {
  private readonly ruta = inject(ActivatedRoute);
  protected readonly perfilSesion = inject(PerfilSesionServicio);

  protected readonly tituloModulo = String(this.ruta.snapshot.data['titulo'] ?? 'PANEL');
  protected readonly etiquetaRol = String(this.ruta.snapshot.data['rol'] ?? 'Administrador');
  protected readonly perfil = this.perfilSesion.perfil;

  private readonly admin: PerfilSesion[] = ['Administrador'];
  private readonly operacion: PerfilSesion[] = ['Administrador', 'Operativo'];

  /** Ruta guiada: Materiales + Porcentajes + Bordado → Receta → Precio → Producto. */
  protected readonly grupos: GrupoPanel[] = [
    {
      titulo: 'Catálogos',
      enlaces: [
        { etiqueta: 'Productos', ruta: '/admin/productos', roles: this.admin },
        { etiqueta: 'Categorías', ruta: '/admin/productos/categorias', roles: this.admin },
        { etiqueta: 'Nuevas', ruta: '/admin/productos/nuevas', roles: this.admin },
        { etiqueta: 'Imágenes', ruta: '/admin/productos/imagenes', roles: this.admin },
        { etiqueta: 'Materiales', ruta: '/inventario-mp/catalogo', roles: this.admin },
        { etiqueta: 'Recetas y costos', ruta: '/admin/recetas', roles: this.admin },
      ],
    },
    {
      titulo: 'Operación',
      enlaces: [
        { etiqueta: 'Pedidos', ruta: '/admin/pedidos', roles: this.operacion },
        { etiqueta: 'Inventario PT', ruta: '/operacion/inventario-pt', roles: this.operacion },
        { etiqueta: 'Inventario MP', ruta: '/inventario-mp', roles: this.operacion },
        { etiqueta: 'Producción', ruta: '/produccion', roles: this.operacion },
        { etiqueta: 'Mermas', ruta: '/mermas', roles: this.operacion },
        { etiqueta: 'Preparación', ruta: '/preparacion', roles: this.operacion },
        { etiqueta: 'Entregas', ruta: '/entregas', roles: this.operacion },
        { etiqueta: 'Recepciones', ruta: '/recepciones', roles: this.operacion },
        { etiqueta: 'Devoluciones', ruta: '/operacion/devoluciones', roles: this.operacion },
      ],
    },
    {
      titulo: 'Gerencia',
      enlaces: [
        { etiqueta: 'Ventas', ruta: '/ventas', roles: this.admin },
        { etiqueta: 'Compras', ruta: '/compras', roles: this.admin },
        { etiqueta: 'Proveedores', ruta: '/proveedores', roles: this.admin },
        { etiqueta: 'Dashboard', ruta: '/dashboard', roles: this.operacion },
        { etiqueta: 'Alertas', ruta: '/alertas', roles: this.operacion },
        { etiqueta: 'Sistema', ruta: '/sistema', roles: this.admin },
      ],
    },
  ];

  protected readonly flujo = computed(() =>
    this.perfil() === 'Cliente'
      ? 'Explora el catálogo y realiza tu compra en la tienda.'
      : 'Materiales → Receta → Precio → Producto → Variantes → Imágenes',
  );

  visible(grupo: GrupoPanel): EnlacePanel[] {
    const perfil = this.perfil();
    return perfil ? grupo.enlaces.filter((enlace) => enlace.roles.includes(perfil)) : [];
  }
}
