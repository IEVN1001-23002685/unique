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

/**
 * decimalPositivo (§10.3b): mayor que 0 con hasta 4 decimales.
 * Se usa en cantidades de M14 y queda disponible para M11, M15 y M17.
 */
export const decimalPositivo: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    return { decimalPositivo: true };
  }

  const texto = String(valor);
  const decimales = texto.includes('.') ? (texto.split('.')[1]?.length ?? 0) : 0;
  return decimales <= 4 ? null : { decimalPositivo: true };
};

/** Igual que decimalPositivo pero acepta cero; útil en mínimos y seguridad. */
export const decimalNoNegativo: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const valor = control.value;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
    return { decimalNoNegativo: true };
  }

  const texto = String(valor);
  const decimales = texto.includes('.') ? (texto.split('.')[1]?.length ?? 0) : 0;
  return decimales <= 4 ? null : { decimalNoNegativo: true };
};

/** mermaPct (§10.3b): entre 0 y menor que 100, con hasta 2 decimales. */
export const mermaPct: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor >= 100) {
    return { mermaPct: true };
  }

  const texto = String(valor);
  const decimales = texto.includes('.') ? (texto.split('.')[1]?.length ?? 0) : 0;
  return decimales <= 2 ? null : { mermaPct: true };
};

/** §10.3b · passwordFuerte: mínimo 8 caracteres con mayúscula, minúscula, número y símbolo. */
export const passwordFuerte: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value;
  if (typeof valor !== 'string' || valor.length === 0) {
    return null; // La presencia se valida con required.
  }

  const faltan: string[] = [];
  if (valor.length < 8) faltan.push('longitud');
  if (!/[A-Z]/.test(valor)) faltan.push('mayuscula');
  if (!/[a-z]/.test(valor)) faltan.push('minuscula');
  if (!/\d/.test(valor)) faltan.push('numero');
  if (!/[^A-Za-z0-9]/.test(valor)) faltan.push('simbolo');

  return faltan.length === 0 ? null : { passwordFuerte: faltan };
};

/** §10.3b · coincide: confirmación igual al campo original dentro de un FormGroup. */
export const coincide = (campo: string, campoConfirmacion: string): ValidatorFn => {
  return (control: AbstractControl): ValidationErrors | null => {
    const original = control.get(campo)?.value;
    const confirmacion = control.get(campoConfirmacion)?.value;
    if (confirmacion === null || confirmacion === undefined || confirmacion === '') {
      return null;
    }
    return original === confirmacion ? null : { coincide: true };
  };
};

/** §10.3b · tarjetaLuhn: 16 dígitos que pasan el algoritmo de Luhn. */
export const tarjetaLuhn: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value;
  if (typeof valor !== 'string' || valor.trim() === '') {
    return null; // La presencia se valida con required.
  }

  const digitos = valor.replace(/\D/g, '');
  if (!/^\d{16}$/.test(digos)) {
    return { tarjetaLuhn: true };
  }

  let suma = 0;
  let duplicar = false;
  for (let indice = digitos.length - 1; indice >= 0; indice -= 1) {
    let digito = Number(digos.charAt(indice));
    if (duplicar) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
    duplicar = !duplicar;
  }

  return suma % 10 === 0 ? null : { tarjetaLuhn: true };
};

/** §10.3b · vencimientoFuturo: MM/AA o MM/AAAA vigente. */
export const vencimientoFuturo: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const valor = control.value;
  if (typeof valor !== 'string' || !/^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(valor.trim())) {
    return { vencimientoFuturo: true };
  }

  const partes = valor.trim().split('/');
  const mes = Number(partes[0]);
  let anio = Number(partes[1]);
  if (anio < 100) anio += 2000;

  // El mes capturado todavía es válido; se compara contra el primer día del siguiente mes.
  const finVencimiento = new Date(anio, mes, 1);
  return finVencimiento > new Date() ? null : { vencimientoFuturo: true };
};

/** §10.3b · cvv: 3 o 4 dígitos. Nunca se guarda en el cliente ni se envía para almacenarlo. */
export const cvv: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value;
  if (typeof valor !== 'string' || valor.trim() === '') {
    return null; // La presencia se valida con required.
  }

  return /^\d{3,4}$/.test(valor.trim()) ? null : { cvv: true };
};

/**
 * §10.3b · cantidadEntera: entero entre 1 y el máximo de la línea (10 en M04).
 * La comprobación pura se reutiliza en el servicio del carrito; Flask valida el valor real.
 */
export function esCantidadEnteraValida(cantidad: number, maximo: number): boolean {
  return Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= maximo;
}

export const cantidadEntera = (maximo: number): ValidatorFn => {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (typeof valor !== 'number' || !esCantidadEnteraValida(valor, maximo)) {
      return { cantidadEntera: { maximo } };
    }
    return null;
  };
};
