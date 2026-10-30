import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { almacenLocal } from '../utils/almacen-local';

export type Idioma = 'es' | 'en';

export const IDIOMAS: readonly Idioma[] = ['es', 'en'];
export const IDIOMA_POR_DEFECTO: Idioma = 'es';
export const CLAVE_IDIOMA = 'hk.idioma';
const LOCALES: Record<Idioma, string> = { es: 'es-CO', en: 'en-US' };

export function leerIdiomaGuardado(): Idioma {
  const guardado = almacenLocal.leer(CLAVE_IDIOMA);
  return IDIOMAS.find((i) => i === guardado) ?? IDIOMA_POR_DEFECTO;
}

/**
 * Idioma activo de la interfaz (DESIGN-SYSTEM §10): sincroniza Transloco, `<html lang>`
 * y la preferencia guardada. `locale` es el que usan los formateadores de moneda y fecha.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  readonly idioma = signal<Idioma>(leerIdiomaGuardado());
  readonly locale = computed(() => LOCALES[this.idioma()]);

  constructor() {
    effect(() => {
      const idioma = this.idioma();
      this.transloco.setActiveLang(idioma);
      this.document.documentElement.lang = idioma;
    });
  }

  cambiar(idioma: Idioma): void {
    this.idioma.set(idioma);
    almacenLocal.escribir(CLAVE_IDIOMA, idioma);
  }
}
