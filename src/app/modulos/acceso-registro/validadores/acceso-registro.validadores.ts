import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** §10.3b · telefono10: exactamente 10 dígitos. */
export function telefono10(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }
  return /^\d{10}$/.test(String(valor)) ? null : { telefono10: true };
}

/** §10.3b · passwordFuerte: mínimo 8 caracteres con mayúscula, minúscula, número y símbolo. */
export function passwordFuerte(control: AbstractControl): ValidationErrors | null {
  const valor = control.value;
  if (typeof valor !== 'string' || valor.length === 0) {
    return null;
  }

  const faltan: string[] = [];
  if (valor.length < 8) {
    faltan.push('longitud');
  }
  if (!/[A-Z]/.test(valor)) {
    faltan.push('mayuscula');
  }
  if (!/[a-z]/.test(valor)) {
    faltan.push('minuscula');
  }
  if (!/\d/.test(valor)) {
    faltan.push('numero');
  }
  if (!/[^A-Za-z0-9]/.test(valor)) {
    faltan.push('simbolo');
  }

  return faltan.length === 0 ? null : { passwordFuerte: faltan };
}

/** §10.3b · coincide: confirmación igual al campo original dentro de un FormGroup. */
export function coincide(campo: string, campoConfirmacion: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const original = control.get(campo)?.value;
    const confirmacion = control.get(campoConfirmacion)?.value;
    if (confirmacion === null || confirmacion === undefined || confirmacion === '') {
      return null;
    }
    return original === confirmacion ? null : { coincide: true };
  };
}
