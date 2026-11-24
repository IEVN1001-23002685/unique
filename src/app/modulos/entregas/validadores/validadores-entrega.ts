import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Helpers de validación de presentación de M19. Flask sigue siendo la autoridad. */

function fechaHoy(): string {
  const fecha = new Date();
  const dos = (valor: number): string => String(valor).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** fechaNoPasada (§10): fecha igual o posterior a hoy. */
export const fechaNoPasada: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = String(control.value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return { fechaInvalida: true };
  }
  return valor >= fechaHoy() ? null : { fechaPasada: true };
};

/** Teléfono mexicano de 10 dígitos, aceptando espacios y paréntesis en la captura. */
export const telefonoDiezDigitos: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const valor = String(control.value ?? '');
  return valor.replace(/\D/g, '').length === 10 ? null : { telefonoInvalido: true };
};
