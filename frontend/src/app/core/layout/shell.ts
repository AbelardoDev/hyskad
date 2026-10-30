import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkBottomNav } from './bottom-nav';
import { LayoutService } from './layout.service';
import { HkMenuMovil } from './menu-movil';
import { HkSidebarNav } from './sidebar-nav';
import { HkTopbar } from './topbar';

/**
 * Esqueleto de la app (DESIGN-SYSTEM §5): sidebar fijo de 260 px colapsable a 76 px (≥ 768 px),
 * drawer y barra inferior en móvil, topbar con vidrio y contenido de máximo 1440 px.
 */
@Component({
  selector: 'hk-shell',
  imports: [RouterOutlet, TranslocoPipe, HkSidebarNav, HkTopbar, HkBottomNav],
  template: `
    <a
      href="#contenido"
      class="fixed top-2 left-2 z-50 -translate-y-20 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-overlay hk-foco transition-transform focus:translate-y-0"
    >
      {{ 'layout.saltar_contenido' | transloco }}
    </a>

    <aside
      class="fixed inset-y-0 left-0 z-40 overflow-hidden bg-linear-to-b from-sidebar-bg to-sidebar-bg-2 transition-[width] duration-250 ease-hk max-md:hidden dark:border-r dark:border-white/5"
      [class]="layout.colapsado() ? 'w-[76px]' : 'w-[260px]'"
    >
      <hk-sidebar-nav [colapsado]="layout.colapsado()" />
    </aside>

    <div
      class="flex min-h-dvh min-w-0 flex-col transition-[padding] duration-250 ease-hk"
      [class]="layout.colapsado() ? 'md:pl-[76px]' : 'md:pl-[260px]'"
    >
      <hk-topbar (alternarMenu)="alternarMenu()" />
      <main
        id="contenido"
        tabindex="-1"
        class="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-6 pb-28 outline-none md:px-6 md:pb-10 lg:px-8"
      >
        <router-outlet />
      </main>
    </div>

    <hk-bottom-nav />
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkShell {
  protected readonly layout = inject(LayoutService);
  private readonly dialogos = inject(DialogosService);

  protected alternarMenu(): void {
    if (this.layout.esMovil()) this.dialogos.abrirDrawer(HkMenuMovil, { lado: 'izquierda' });
    else this.layout.alternarSidebar();
  }
}
