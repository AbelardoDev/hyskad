import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkLogo } from '../../shared/ui/logo/logo';
import { HkPreferenciasInvitado } from './preferencias-invitado';

/**
 * Pantallas de acceso (DESIGN-SYSTEM §7, Login): a la izquierda el panel navy con malla de puntos,
 * logo y frase del producto; a la derecha el formulario con idioma y tema arriba. En móvil solo
 * el formulario con el logo encima.
 */
@Component({
  selector: 'hk-auth-layout',
  imports: [RouterOutlet, TranslocoPipe, LucideDynamicIcon, HkLogo, HkPreferenciasInvitado],
  template: `
    <aside
      class="relative hidden overflow-hidden bg-linear-to-br from-brand-950 via-brand-900 to-brand-800 p-12 lg:flex lg:flex-col lg:justify-between xl:p-16"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(140_188_255/0.18)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_top_left,black_30%,transparent_75%)] bg-size-[22px_22px]"
        aria-hidden="true"
      ></div>
      <div
        class="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full bg-accent/20 blur-3xl"
        aria-hidden="true"
      ></div>

      <hk-logo variante="completo" fondo="oscuro" class="relative h-10" />

      <div class="relative max-w-md">
        <p
          class="font-display text-4xl leading-tight font-bold tracking-tight text-balance text-brand-50 xl:text-5xl"
        >
          {{ 'auth.panel.titulo' | transloco }}
        </p>
        <p class="mt-5 text-lg text-balance text-brand-200">{{ 'auth.panel.texto' | transloco }}</p>
        <ul class="mt-10 space-y-3 text-sm text-brand-100">
          @for (punto of puntos; track punto.clave) {
            <li class="flex items-center gap-3">
              <span
                class="inline-flex size-8 items-center justify-center rounded-lg bg-white/8 text-accent ring-1 ring-white/10"
              >
                <svg [lucideIcon]="punto.icono" class="size-4" aria-hidden="true" />
              </span>
              {{ punto.clave | transloco }}
            </li>
          }
        </ul>
      </div>

      <p class="relative text-xs text-brand-300">{{ 'auth.panel.pie' | transloco }}</p>
    </aside>

    <main class="flex min-h-dvh flex-col">
      <div class="flex justify-end px-4 pt-4 md:px-6">
        <hk-preferencias-invitado />
      </div>
      <div class="flex flex-1 items-center justify-center px-4 pt-4 pb-12">
        <div class="w-full max-w-md animate-entrada">
          <div class="mb-8 flex justify-center lg:hidden">
            <hk-logo variante="completo" class="h-9" />
          </div>
          <router-outlet />
        </div>
      </div>
    </main>
  `,
  host: { class: 'grid min-h-dvh bg-bg lg:grid-cols-2' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayout {
  protected readonly puntos = [
    { clave: 'auth.panel.punto_taller', icono: 'wrench' },
    { clave: 'auth.panel.punto_inventario', icono: 'package' },
    { clave: 'auth.panel.punto_ventas', icono: 'shopping-cart' },
  ];
}
