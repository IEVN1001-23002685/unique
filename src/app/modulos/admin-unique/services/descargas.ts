/** Utilidades de descarga compartidas por los módulos M18–M22. */

export function abrirPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const ventana = window.open(url, '_blank');
  if (!ventana) {
    descargarArchivo(blob, 'documento.pdf');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function descargarTexto(texto: string, nombreArchivo: string, tipo = 'text/csv;charset=utf-8'): void {
  descargarArchivo(new Blob([texto], { type: tipo }), nombreArchivo);
}

function descargarArchivo(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
