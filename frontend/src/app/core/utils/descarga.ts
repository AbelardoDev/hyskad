/** Descarga un archivo recibido del backend (CSV de reportes y movimientos) con el nombre dado. */
export function descargarArchivo(
  archivo: Blob,
  nombre: string,
  documento: Document = document,
): void {
  const url = URL.createObjectURL(archivo);
  const enlace = documento.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}
