import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthSessionService } from '../services/auth-session.service';
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `<main class="login-wrap">
    <section class="login-card">
      <div class="logo">UNIQUE</div>
      <small>tan único como tú</small>
      <h1>Panel administrativo</h1>
      <p>Inicia sesión con tu cuenta de Operativo o Administrador.</p>
      <form [formGroup]="form" (ngSubmit)="entrar()">
        <label
          >Correo electrónico<input
            type="email"
            formControlName="correo"
            placeholder="correo@unique.com" /></label
        ><label
          >Contraseña<input
            type="password"
            formControlName="contrasena"
            placeholder="Tu contraseña"
        /></label>
        <div class="error" *ngIf="error">{{ error }}</div>
        <button [disabled]="form.invalid || cargando">
          {{ cargando ? 'Validando...' : 'Iniciar sesión' }}
        </button>
      </form>
    </section>
  </main>`,
  styles: [
    `
      .login-wrap {
        min-height: 100vh;
        background: #f2d5ed;
        display: grid;
        place-items: center;
        font-family: Arial;
      }
      .login-card {
        width: min(420px, calc(100% - 36px));
        background: #fff;
        padding: 38px;
        border-radius: 22px;
        box-shadow: 0 12px 40px #542d5920;
        color: #542d59;
      }
      .logo {
        font: bold 32px Georgia;
        text-align: center;
      }
      .login-card > small {
        display: block;
        text-align: center;
        color: #8b548c;
      }
      .login-card h1 {
        font-size: 22px;
        margin: 28px 0 5px;
      }
      .login-card p {
        font-size: 13px;
        color: #6b5870;
        margin-bottom: 25px;
      }
      .login-card label {
        display: block;
        font-size: 12px;
        margin: 15px 0;
      }
      .login-card input {
        display: block;
        width: 100%;
        box-sizing: border-box;
        margin-top: 7px;
        padding: 12px;
        border: 1px solid #ddcadd;
        border-radius: 10px;
      }
      .login-card button {
        width: 100%;
        padding: 13px;
        border: 0;
        border-radius: 30px;
        background: #542d59;
        color: #fff;
        font-weight: bold;
        cursor: pointer;
      }
      .login-card button:disabled {
        opacity: 0.5;
      }
      .error {
        color: #c8374b;
        font-size: 12px;
        margin: 10px 0;
      }
    `,
  ],
})
export class LoginPageComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthSessionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  cargando = false;
  error = '';
  form = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  entrar() {
    if (this.form.invalid) return;
    this.cargando = true;
    this.error = '';
    const credenciales = this.form.getRawValue();
    this.auth
      .iniciarSesion(credenciales.correo ?? '', credenciales.password ?? '')
      .subscribe({
        next: () => {
          const dest = this.route.snapshot.queryParamMap.get('returnUrl') || '/panel-admin';
          this.router.navigateByUrl(dest);
        },
        error: (e) => {
          this.error = e.error?.mensaje ?? 'No fue posible iniciar sesión. Revisa tus datos.';
          this.cargando = false;
        },
      });
  }
}
