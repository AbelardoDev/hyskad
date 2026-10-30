import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkLogo } from '../../shared/ui/logo/logo';
import { HkTooltipDirective } from '../../shared/ui/tooltip/tooltip';
import { MENU } from './menu.config';

/**
 * Contenido del sidebar (logo + menú agrupado). Lo usan el sidebar fijo de escritorio/tablet
 * y el drawer de móvil. El fondo es oscuro en ambos temas (identidad de marca).
 */
@Component({
  selector: 'hk-sidebar-nav',
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    LucideDynamicIcon,
    HkLogo,
    HkTooltipDirective,
  ],
  template: `
    <a
      routerLink="/dashboard"
      class="flex h-16 shrink-0 items-center rounded-lg outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-brand-300"
      [class]="colapsado() ? 'justify-center px-2' : 'px-5'"
      [attr.aria-label]="'menu.dashboard' | transloco"
      (click)="navegar.emit()"
    >
      @if (colapsado()) {
        <hk-logo variante="simbolo" fondo="oscuro" class="h-8" />
      } @else {
        <hk-logo variante="completo" fondo="oscuro" class="h-7" />
      }
    </a>

    <nav
      class="flex-1 [scrollbar-color:rgb(255_255_255/0.15)_transparent] overflow-x-hidden overflow-y-auto px-3 pt-2 pb-6"
      [attr.aria-label]="'layout.navegacion_principal' | transloco"
    >
      @for (grupo of menu; track grupo.clave) {
        <div class="mt-5 first:mt-1">
          @if (colapsado()) {
            <div
              class="mx-auto mb-2 h-px w-6 bg-sidebar-fg/15 first:hidden"
              aria-hidden="true"
            ></div>
          } @else {
            <p
              class="mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-wider text-brand-300 uppercase"
            >
              {{ grupo.clave | transloco }}
            </p>
          }
          <ul class="flex flex-col gap-0.5">
            @for (item of grupo.items; track item.ruta) {
              <li>
                <a
                  [routerLink]="item.ruta"
                  routerLinkActive="hk-activo"
                  #rla="routerLinkActive"
                  [attr.aria-current]="rla.isActive ? 'page' : null"
                  class="group relative flex h-10 items-center gap-3 rounded-xl text-sm font-medium text-sidebar-fg transition-colors duration-150 hover:bg-white/6 hover:text-sidebar-active focus-visible:outline-2 focus-visible:outline-brand-300 max-md:h-11 [&.hk-activo]:bg-white/10 [&.hk-activo]:text-sidebar-active"
                  [class]="colapsado() ? 'justify-center px-0' : 'px-3'"
                  [hkTooltip]="item.clave | transloco"
                  hkTooltipPosicion="derecha"
                  [hkTooltipDeshabilitado]="!colapsado()"
                  [attr.aria-label]="colapsado() ? (item.clave | transloco) : null"
                  (click)="navegar.emit()"
                >
                  <span
                    class="absolute top-2 bottom-2 left-0 w-0.75 rounded-full bg-accent opacity-0 transition-opacity group-[.hk-activo]:opacity-100"
                    [class.-left-3]="!colapsado()"
                    [class.-left-1.5]="colapsado()"
                    aria-hidden="true"
                  ></span>
                  <svg
                    [lucideIcon]="item.icono"
                    class="size-4.5 shrink-0 transition-colors group-[.hk-activo]:text-accent"
                    aria-hidden="true"
                  />
                  @if (!colapsado()) {
                    <span class="truncate">{{ item.clave | transloco }}</span>
                  }
                </a>
              </li>
            }
          </ul>
        </div>
      }
    </nav>
  `,
  host: { class: 'flex h-full flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkSidebarNav {
  readonly colapsado = input(false, { transform: booleanAttribute });
  /** Se emite al elegir un destino (el drawer móvil se cierra). */
  readonly navegar = output<void>();

  protected readonly menu = MENU;
}
