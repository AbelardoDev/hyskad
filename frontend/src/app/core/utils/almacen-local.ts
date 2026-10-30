/**
 * Acceso a localStorage que nunca lanza: en modo privado o con el almacenamiento bloqueado
 * la app sigue funcionando con los valores por defecto. Solo para preferencias de interfaz.
 */
export const almacenLocal = {
  leer(clave: string): string | null {
    try {
      return globalThis.localStorage?.getItem(clave) ?? null;
    } catch {
      return null;
    }
  },
  escribir(clave: string, valor: string): void {
    try {
      globalThis.localStorage?.setItem(clave, valor);
    } catch {
      // Sin almacenamiento disponible: la preferencia dura lo que dure la pestaña.
    }
  },
};
