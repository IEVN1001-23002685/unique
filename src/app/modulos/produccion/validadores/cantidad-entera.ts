import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Cantidad en unidades enteras (§6 y §7 de M16). Solo valida la forma: la
 * disponibilidad real y la conversión a unidades base las confirma Flask.
 */
export const enteroPositivo: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value;
  if (
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    !Number.isInteger(valor) ||
    valor < 1
  ) {
    return { enteroPositivo: true };
  }
  return null;
};

/** Entero de cero en adelante, para aprobadas, merma y reproceso del dictamen. */
export const enteroNoNegativo: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const valor = control.value;
  if (
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    !Number.isInteger(valor) ||
    valor < 0
  ) {
    return { enteroNoNegativo: true };
  }
  return null;
};
