import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validadores de presentación reutilizables (§10.3b del documento UNIQUE v3.0).
 * Solo validan la forma: la validación autoritativa corresponde a Flask.
 */

/** RFC de persona moral (12 caracteres) o física (13), con estructura oficial básica. */
export const rfcValido: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value;
  if (typeof valor !== 'string' || valor.trim() === '') {
    return null; // El RFC es opcional en el padrón; si se pide, se marcará required aparte.
  }

  const rfc = valor.trim().toUpperCase();
  const estructura = /^([A-ZÑ&]{3,4})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([A-Z\d]{3})$/;

  return estructura.test(rfc) ? null : { rfc: true };
};

/** Exactamente 10 dígitos; se ignoran espacios y guiones. */
export const telefono10: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value;
  if (typeof valor !== 'string' || valor.trim() === '') {
    return null; // La presencia se valida con required.
  }

  const digitos = valor.replace(/\D/g, '');
  return digitos.length === 10 ? null : { telefono10: true };
};

/** Código postal mexicano de 5 dígitos (§10 del documento UNIQUE v3.0). */
export const codigoPostal5: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value;
  if (typeof valor !== 'string' || valor.trim() === '') {
    return null; // La presencia se valida con required.
  }

  return /^\d{5}$/.test(valor.trim()) ? null : { codigoPostal5: true };
};
