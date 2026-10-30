import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { ACCESOS_RAPIDOS } from './menu.config';

/** Barra de navegación inferior en móvil con los accesos rápidos del menú. */
@Component({
  selector: 'hk-bottom-nav',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe, LucideDynamicIcon],
  template: `
    <nav [attr.aria-label]="'layout.navegacion_inferior' | transloco">
      <ul class="grid grid-cols-4">
        @for (item of accesos; track item.ruta) {
          <li>
            <a
              [routerLink]="item.ruta"
              routerLinkActive="hk-activo"
              #rla="routerLinkActive"
              [attr.aria-current]="rla.isActive ? 'page' : null"
              class="group flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] font-medium text-muted hk-foco transition-colors [&.hk-activo]:text-primary"
            >
              <span
                class="inline-flex h-7 w-12 items-center justify-center rounded-full transition-colors group-[.hk-activo]:bg-primary-soft"
              >
                <svg [lucideIcon]="item.icono" class="size-5" aria-hidden="true" />
              </span>
              <span class="max-w-full truncate">{{
                item.claveCorta ?? item.clave | transloco
              }}</span>
            </a>
          </li>
        }
      </ul>
    </nav>
  `,
  host: {
    class:
      'fixed inset-x-0 bottom-0 z-30 block border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkBottomNav {
  protected readonly accesos = ACCESOS_RAPIDOS;
}
