import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { filter, map } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { Permiso } from '../../core/auth/permisos';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkTabs, Pestana } from '../../shared/ui/tabs/tabs';

/**
 * Pestañas de reportes: cada una exige, además de `REPORTES_VER`, el permiso de su área (igual que
 * el backend). El orden define la pestaña por defecto.
 */
export const PESTANAS_REPORTES: readonly { id: string; icono: string; permiso: Permiso }[] = [
  { id: 'servicios', icono: 'wrench', permiso: 'PRESUPUESTOS_GESTIONAR' },
  { id: 'inventario', icono: 'package', permiso: 'PRODUCTOS_GESTIONAR' },
  { id: 'ventas', icono: 'shopping-cart', permiso: 'VENTAS_ANULAR' },
  { id: 'cuentas-pendientes', icono: 'banknote', permiso: 'PAGOS_REGISTRAR' },
];

/** Reportes (RF26, RF32, RF33): pestañas enlazadas a las rutas hijas. */
@Component({
  selector: 'hk-reportes-page',
  imports: [RouterOutlet, TranslocoPipe, HkPageHeader, HkTabs],
  template: `
    <hk-page-header
      class="print:mb-2"
      [titulo]="'reportes.titulo' | transloco"
      [subtitulo]="'reportes.subtitulo' | transloco"
    />
    <hk-tabs
      class="[&>[role=tablist]]:print:hidden"
      [pestanas]="pestanas()"
      [activa]="activa()"
      [etiqueta]="'reportes.titulo' | transloco"
      (activaChange)="ir($event)"
    >
      <router-outlet />
    </hk-tabs>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportesPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);

  private readonly traducciones = toSignal(this.transloco.selectTranslation());
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly pestanas = computed<Pestana[]>(() => {
    this.traducciones();
    return PESTANAS_REPORTES.filter((p) => this.auth.tienePermiso(p.permiso)).map((p) => ({
      id: p.id,
      icono: p.icono,
      etiqueta: this.transloco.translate(`reportes.pestanas.${p.id}`),
    }));
  });
  protected readonly activa = computed(
    () => this.url().split('?')[0].split('/').filter(Boolean)[1] ?? '',
  );

  protected ir(id: string): void {
    void this.router.navigate(['/reportes', id]);
  }
}
