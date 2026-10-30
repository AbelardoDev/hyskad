import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { Permiso } from '../../auth/permisos';
import { HkTienePermisoDirective } from '../../auth/tiene-permiso.directive';
import { HkButton } from '../../../shared/ui/button/button';
import { HkCard } from '../../../shared/ui/card/card';
import { HkEmptyState } from '../../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../../shared/ui/page-header/page-header';

export interface AccionProximamente {
  /** Clave i18n del texto. */
  clave: string;
  icono: string;
  ruta: string;
  permiso: Permiso;
}

/** Página temporal de un módulo aún no construido. Recibe `miga` e `icono` desde la data de la ruta. */
@Component({
  selector: 'hk-proximamente-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    HkButton,
    HkCard,
    HkEmptyState,
    HkPageHeader,
    HkTienePermisoDirective,
  ],
  template: `
    <hk-page-header [titulo]="miga() | transloco">
      @if (accion(); as a) {
        <a hk-button [icono]="a.icono" [routerLink]="a.ruta" *hkTienePermiso="a.permiso">{{
          a.clave | transloco
        }}</a>
      }
    </hk-page-header>
    <hk-card>
      <hk-empty-state
        [icono]="icono()"
        [titulo]="'proximamente.titulo' | transloco: { modulo: (miga() | transloco) }"
        [texto]="'proximamente.texto' | transloco"
      >
        <a hk-button variante="secondary" icono="house" routerLink="/dashboard">{{
          'comun.volver_inicio' | transloco
        }}</a>
      </hk-empty-state>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProximamentePage {
  /** Clave i18n del módulo (data `miga` de la ruta, enlazada con `withComponentInputBinding`). */
  readonly miga = input.required<string>();
  readonly icono = input('construction');
  /** Acción principal del módulo, visible solo con su permiso (data `accion` de la ruta). */
  readonly accion = input<AccionProximamente>();
}
