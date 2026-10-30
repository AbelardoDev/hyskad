import { DOCUMENT } from '@angular/common';
import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';

import { almacenLocal } from '../utils/almacen-local';

export type PreferenciaTema = 'system' | 'light' | 'dark';

export const CLAVE_TEMA = 'hk.tema';
const PREFERENCIAS: readonly PreferenciaTema[] = ['system', 'light', 'dark'];

/** Color de la barra del navegador en móvil: el fondo de la topbar en cada tema. */
export const THEME_COLOR = { light: '#F5F8FD', dark: '#070D1A' } as const;

/**
 * Tema claro/oscuro (DESIGN-SYSTEM §1.5). En `system` sigue a `prefers-color-scheme` en vivo.
 * El script inline de index.html aplica la clase `.dark` antes de que arranque Angular;
 * este servicio la mantiene sincronizada después.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly consulta = this.document.defaultView?.matchMedia?.(
    '(prefers-color-scheme: dark)',
  );
  private readonly sistemaOscuro = signal(this.consulta?.matches ?? false);
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  readonly preferencia = signal<PreferenciaTema>(this.leerPreferencia());
  readonly oscuro = computed(() =>
    this.preferencia() === 'system' ? this.sistemaOscuro() : this.preferencia() === 'dark',
  );

  constructor() {
    const alCambiarSistema = (e: MediaQueryListEvent) => this.sistemaOscuro.set(e.matches);
    this.consulta?.addEventListener('change', alCambiarSistema);
    inject(DestroyRef).onDestroy(() => {
      this.consulta?.removeEventListener('change', alCambiarSistema);
      clearTimeout(this.temporizador);
    });

    let primeraVez = true;
    effect(() => {
      const oscuro = this.oscuro();
      this.aplicar(oscuro, !primeraVez);
      primeraVez = false;
    });
  }

  cambiar(preferencia: PreferenciaTema): void {
    this.preferencia.set(preferencia);
    almacenLocal.escribir(CLAVE_TEMA, preferencia);
  }

  private leerPreferencia(): PreferenciaTema {
    const guardada = almacenLocal.leer(CLAVE_TEMA);
    return PREFERENCIAS.find((p) => p === guardada) ?? 'system';
  }

  private aplicar(oscuro: boolean, animar: boolean): void {
    const html = this.document.documentElement;
    if (animar) {
      html.classList.add('hk-cambiando-tema');
      clearTimeout(this.temporizador);
      this.temporizador = setTimeout(() => html.classList.remove('hk-cambiando-tema'), 250);
    }
    html.classList.toggle('dark', oscuro);
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', oscuro ? THEME_COLOR.dark : THEME_COLOR.light);
  }
}
