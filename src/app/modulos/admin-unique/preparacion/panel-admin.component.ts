import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { AvisoToast } from '../../../compartido/componentes/aviso-toast/aviso-toast';
import { SelectorPerfilDemo } from '../../../compartido/componentes/selector-perfil-demo/selector-perfil-demo';
import {
  PerfilDemoServicio,
  type PerfilDemo,
} from '../../../nucleo/servicios/perfil-demo-servicio';
import { AuthSessionService, type RolUsuario } from '../services/auth-session.service';

interface EnlacePanel {
  etiqueta: string;
  ruta: string;
  icono: string;
  roles: RolUsuario[];
  exacto?: boolean;
}

interface GrupoPanel {
  titulo: string;
  enlaces: EnlacePanel[];
}

const ADMIN: RolUsuario[] = ['ADMIN'];
const OPERATIVO_Y_ADMIN: RolUsuario[] = ['ADMIN', 'OPERATIVO'];
const TODOS: RolUsuario[] = ['CLIENTE', 'ADMIN', 'OPERATIVO'];

/**
 * Shell único del panel administrativo. Sustituye al antiguo layout de
 * `Administracion` y conserva el diseño Vintage Collegiate del panel nuevo.
 * La visibilidad de enlaces es orientativa: la autoridad la aplica Flask.
 */
@Component({
  selector: 'app-panel-admin',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    AvisoToast,
    SelectorPerfilDemo,
  ],
  templateUrl: './panel-admin.component.html',
  styleUrl: './panel-admin.component.css',
})
export class PanelAdminComponent {
  private readonly auth = inject(AuthSessionService);
  private readonly perfilDemo = inject(PerfilDemoServicio);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly titulo = signal('Panel administrativo');
  protected readonly menuAbierto = signal(false);

  /** El selector de demostración gobierna la visibilidad del menú; los guards y Flask deciden el acceso real. */
  protected readonly rol = computed<RolUsuario>(() => this.aRol(this.perfilDemo.perfil()));

  private readonly grupos: GrupoPanel[] = [
    {
      titulo: 'General',
      enlaces: [
        { etiqueta: 'Inicio', ruta: '/panel', icono: '⌂', roles: OPERATIVO_Y_ADMIN, exacto: true },
        { etiqueta: 'Ver tienda', ruta: '/catalogo', icono: '◇', roles: TODOS },
      ],
    },
    {
      titulo: 'Catálogos',
      enlaces: [
        { etiqueta: 'Productos', ruta: '/admin/productos', icono: '▤', roles: ADMIN },
        { etiqueta: 'Categorías', ruta: '/admin/productos/categorias', icono: '◫', roles: ADMIN },
        { etiqueta: 'Nuevas', ruta: '/admin/productos/nuevas', icono: '✦', roles: ADMIN },
        { etiqueta: 'Imágenes', ruta: '/admin/productos/imagenes', icono: '▧', roles: ADMIN },
        { etiqueta: 'Materiales', ruta: '/inventario-mp/catalogo', icono: '◈', roles: ADMIN },
        { etiqueta: 'Recetas y costos', ruta: '/admin/recetas', icono: '◍', roles: ADMIN },
      ],
    },
    {
      titulo: 'Operación',
      enlaces: [
        { etiqueta: 'Pedidos', ruta: '/admin/pedidos', icono: '▥', roles: OPERATIVO_Y_ADMIN },
        { etiqueta: 'Inventario PT', ruta: '/operacion/inventario-pt', icono: '▣', roles: OPERATIVO_Y_ADMIN },
        { etiqueta: 'Inventario MP', ruta: '/inventario-mp', icono: '▢', roles: OPERATIVO_Y_ADMIN },
        { etiqueta: 'Producción', ruta: '/produccion', icono: '⚙', roles: OPERATIVO_Y_ADMIN },
        { etiqueta: 'Mermas', ruta: '/mermas', icono: '⊙', roles: OPERATIVO_Y_ADMIN },
        { etiqueta: 'Preparación', ruta: '/panel-admin/preparacion', icono: '▦', roles: OPERATIVO_Y_ADMIN },
        { etiqueta: 'Entregas', ruta: '/panel-admin/entregas', icono: '➜', roles: OPERATIVO_Y_ADMIN },
        { etiqueta: 'Recepciones', ruta: '/recepciones', icono: '⇩', roles: OPERATIVO_Y_ADMIN },
        { etiqueta: 'Devoluciones', ruta: '/operacion/devoluciones', icono: '↶', roles: OPERATIVO_Y_ADMIN },
      ],
    },
    {
      titulo: 'Gerencia',
      enlaces: [
        { etiqueta: 'Ventas', ruta: '/ventas', icono: '＄', roles: ADMIN },
        { etiqueta: 'Compras', ruta: '/compras', icono: '＄', roles: ADMIN },
        { etiqueta: 'Proveedores', ruta: '/proveedores', icono: '◊', roles: ADMIN },
        { etiqueta: 'Dashboard gerencial', ruta: '/panel-admin/dashboard', icono: '▦', roles: OPERATIVO_Y_ADMIN },
        { etiqueta: 'Centro de alertas', ruta: '/panel-admin/alertas', icono: '◉', roles: OPERATIVO_Y_ADMIN },
        { etiqueta: 'Administración', ruta: '/panel-admin/sistema', icono: '⚙', roles: ADMIN },
      ],
    },
  ];

  protected readonly gruposVisibles = computed(() =>
    this.grupos
      .map((grupo) => ({
        titulo: grupo.titulo,
        enlaces: grupo.enlaces.filter((enlace) => enlace.roles.includes(this.rol())),
      }))
      .filter((grupo) => grupo.enlaces.length > 0),
  );

  protected readonly rolEtiqueta = computed(() => this.perfilDemo.perfil());
  protected readonly nombreUsuario = computed(() => this.auth.usuario?.nombre || 'Usuario');
  protected readonly inicialUsuario = computed(() => this.nombreUsuario().charAt(0).toUpperCase());

  constructor() {
    this.actualizarTitulo();
    this.router.events
      .pipe(filter((evento) => evento instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.actualizarTitulo());
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  protected alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  salir(): void {
    this.auth.cerrarSesion().subscribe({
      next: () => this.router.navigateByUrl('/login-admin'),
      error: () => this.router.navigateByUrl('/login-admin'),
    });
  }

  private aRol(perfil: PerfilDemo): RolUsuario {
    if (perfil === 'Administrador') return 'ADMIN';
    if (perfil === 'Operativo') return 'OPERATIVO';
    return 'CLIENTE';
  }

  private actualizarTitulo(): void {
    // `firstChild` es un ActivatedRoute y su `snapshot` puede no existir todavía
    // mientras el RouterOutlet crea el componente; usar el snapshot evita el error.
    const datos = this.ruta.snapshot.firstChild?.data ?? this.ruta.snapshot.data;
    this.titulo.set(String(datos['titulo'] ?? 'Panel administrativo'));
  }
}
