import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HK_ID_TITULO_DIALOGO } from '../../shared/ui/dialog/dialogos.service';
import { AuthService } from '../auth/auth.service';
import { IDIOMAS, LanguageService } from '../i18n/language.service';
import { HkSidebarNav } from './sidebar-nav';

/** Drawer de navegación en móvil (abierto desde la topbar con `DialogosService.abrirDrawer`). */
@Component({
  selector: 'hk-menu-movil',
  imports: [HkSidebarNav, TranslocoPipe, LucideDynamicIcon],
  template: `
    <h2 [id]="idTitulo" class="sr-only">{{ 'layout.navegacion_principal' | transloco }}</h2>
    <button
      type="button"
      class="absolute top-3 right-3 z-1 inline-flex size-11 items-center justify-center rounded-xl text-sidebar-fg transition-colors hover:bg-white/10 hover:text-sidebar-active focus-visible:outline-2 focus-visible:outline-brand-300"
      [attr.aria-label]="'layout.cerrar_menu' | transloco"
      (click)="ref.close()"
    >
      <svg lucideIcon="x" class="size-5" aria-hidden="true" />
    </button>
    <hk-sidebar-nav class="min-h-0 flex-1" (navegar)="ref.close()" />
    <div class="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
      <span class="text-xs font-medium text-sidebar-fg" id="menu-movil-idioma">{{
        'layout.idioma' | transloco
      }}</span>
      <div
        class="inline-flex rounded-xl bg-white/6 p-1"
        role="group"
        aria-labelledby="menu-movil-idioma"
      >
        @for (opcion of idiomas; track opcion) {
          <button
            type="button"
            class="inline-flex h-9 min-w-11 items-center justify-center rounded-lg px-3 text-xs font-semibold uppercase transition-colors focus-visible:outline-2 focus-visible:outline-brand-300"
            [class]="
              idioma.idioma() === opcion
                ? 'bg-brand-50 text-brand-950'
                : 'text-sidebar-fg hover:text-sidebar-active'
            "
            [attr.aria-pressed]="idioma.idioma() === opcion"
            [attr.lang]="opcion"
            (click)="auth.cambiarIdioma(opcion)"
          >
            {{ opcion }}
          </button>
        }
      </div>
    </div>
  `,
  host: {
    class:
      'relative flex h-dvh flex-col bg-linear-to-b from-sidebar-bg to-sidebar-bg-2 pb-[env(safe-area-inset-bottom)] shadow-overlay',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkMenuMovil {
  protected readonly ref = inject(DialogRef);
  protected readonly idTitulo = inject(HK_ID_TITULO_DIALOGO);
  protected readonly idioma = inject(LanguageService);
  protected readonly auth = inject(AuthService);
  protected readonly idiomas = IDIOMAS;
}
