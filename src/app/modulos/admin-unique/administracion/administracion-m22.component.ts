import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiAdminService } from '../services/api-admin.service';
@Component({
  selector: 'app-administracion-m22',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './administracion-m22.component.html',
  styleUrl: '../preparacion/modulos-admin.css',
})
export class AdministracionM22Component implements OnInit {
  private api = inject(ApiAdminService);
  private fb = inject(FormBuilder);
  pestana = 'usuarios';
  usuarios: any[] = [];
  clientes: any[] = [];
  catalogos: any[] = [];
  configuracion: any[] = [];
  bitacora: any[] = [];
  tipoCatalogo = 'colores';
  cargando = true;
  error = '';
  aviso = '';
  filtro = '';
  editId: number | null = null;
  usuarioForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    correo: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.pattern(/^\d{10}$/)]],
    rol: ['OPERATIVO', Validators.required],
    contrasena: [
      '',
      [
        Validators.required,
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/),
      ],
    ],
  });
  catalogoForm = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(12)]],
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: [''],
    codigo_postal_inicio: ['', [Validators.pattern(/^\d{5}$/)]],
    codigo_postal_fin: ['', [Validators.pattern(/^\d{5}$/)]],
    tarifa: [null as number | null, [Validators.min(0)]],
    activo: [true],
  });
  ngOnInit() {
    this.cargar();
  }
  cambiar(t: string) {
    this.pestana = t;
    this.filtro = '';
    this.cargar();
  }
  cargar() {
    this.cargando = true;
    const path =
      this.pestana === 'usuarios'
        ? '/sistema/usuarios'
        : this.pestana === 'clientes'
          ? '/sistema/clientes'
          : this.pestana === 'catalogos'
            ? `/sistema/catalogos/${this.tipoCatalogo}`
            : this.pestana === 'configuracion'
              ? '/sistema/configuracion'
              : '/sistema/bitacora';
    this.api.get<any>(path).subscribe({
      next: (r) => {
        if (this.pestana === 'usuarios') this.usuarios = r.usuarios ?? [];
        if (this.pestana === 'clientes') this.clientes = r.clientes ?? [];
        if (this.pestana === 'catalogos') this.catalogos = r.catalogos ?? [];
        if (this.pestana === 'configuracion') this.configuracion = r.parametros ?? [];
        if (this.pestana === 'bitacora') this.bitacora = r.registros ?? [];
        this.cargando = false;
      },
      error: () => {
        this.error = 'No fue posible cargar la información de administración.';
        this.cargando = false;
      },
    });
  }
  guardarUsuario() {
    if (this.usuarioForm.invalid) {
      this.usuarioForm.markAllAsTouched();
      return;
    }
    const v = this.usuarioForm.getRawValue();
    const req = this.editId
      ? this.api.put(`/sistema/usuarios/${this.editId}`, v)
      : this.api.post('/sistema/usuarios', v);
    req.subscribe({
      next: () => {
        this.aviso = 'Usuario guardado.';
        this.usuarioForm.reset({ rol: 'OPERATIVO' });
        this.usuarioForm.controls.contrasena.setValidators([
          Validators.required,
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/),
        ]);
        this.usuarioForm.controls.contrasena.updateValueAndValidity();
        this.editId = null;
        this.cargar();
      },
      error: (e) => (this.error = e.error?.mensaje ?? 'No se pudo guardar el usuario.'),
    });
  }
  editarUsuario(u: any) {
    this.editId = u.id;
    this.usuarioForm.controls.contrasena.setValidators([
      Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/),
    ]);
    this.usuarioForm.controls.contrasena.updateValueAndValidity();
    this.usuarioForm.patchValue({
      nombre: u.nombre,
      correo: u.correo,
      telefono: u.telefono,
      rol: u.rol,
      contrasena: '',
    });
  }
  restablecer(u: any) {
    const nueva = prompt(
      'Nueva contraseña temporal (mínimo 8 caracteres, mayúscula, minúscula, número y símbolo):',
    );
    if (!nueva) return;
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(nueva)) {
      this.error = 'La contraseña no cumple los requisitos de seguridad.';
      return;
    }
    this.api
      .post(`/sistema/usuarios/${u.id}/restablecer-contrasena`, { contrasena: nueva })
      .subscribe({
        next: () => (this.aviso = 'Contraseña restablecida.'),
        error: () => (this.error = 'No se pudo restablecer la contraseña.'),
      });
  }
  desactivarUsuario(u: any) {
    if (!confirm(`¿Desactivar la cuenta de ${u.nombre}?`)) return;
    this.api.patch(`/sistema/usuarios/${u.id}/desactivar`).subscribe({
      next: () => this.cargar(),
      error: (e) =>
        (this.error =
          e.error?.mensaje ??
          'No se pudo desactivar. Verifica que no sea el último Administrador.'),
    });
  }
  guardarCatalogo() {
    if (this.catalogoForm.invalid) {
      this.catalogoForm.markAllAsTouched();
      return;
    }
    const req = this.editId
      ? this.api.put(
          `/sistema/catalogos/${this.tipoCatalogo}/${this.editId}`,
          this.catalogoForm.getRawValue(),
        )
      : this.api.post(`/sistema/catalogos/${this.tipoCatalogo}`, this.catalogoForm.getRawValue());
    req.subscribe({
      next: () => {
        this.aviso = 'Elemento de catálogo guardado.';
        this.catalogoForm.reset({ activo: true });
        this.editId = null;
        this.cargar();
      },
      error: (e) => (this.error = e.error?.mensaje ?? 'No se pudo guardar el catálogo.'),
    });
  }
  editarCatalogo(x: any) {
    this.editId = x.id;
    this.catalogoForm.patchValue(x);
  }
  desactivarCatalogo(x: any) {
    if (!confirm(`¿Desactivar ${x.nombre}? Si ya fue utilizado, se conserva el historial.`)) return;
    this.api.patch(`/sistema/catalogos/${this.tipoCatalogo}/${x.id}/desactivar`).subscribe({
      next: () => this.cargar(),
      error: () => (this.error = 'No se pudo desactivar el elemento.'),
    });
  }
  guardarParametro(p: any) {
    this.api.put(`/sistema/configuracion/${p.clave}`, { valor: p.valor }).subscribe({
      next: () => (this.aviso = `Parámetro ${p.clave} actualizado.`),
      error: () => (this.error = 'No se pudo actualizar el parámetro.'),
    });
  }
  get lista() {
    const a =
      this.pestana === 'usuarios'
        ? this.usuarios
        : this.pestana === 'clientes'
          ? this.clientes
          : this.catalogos;
    return a.filter((x) => JSON.stringify(x).toLowerCase().includes(this.filtro.toLowerCase()));
  }
}
