import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { HkButton } from '../../../shared/ui/button/button';
import { HkCard } from '../../../shared/ui/card/card';
import { HkEmptyState } from '../../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../../shared/ui/page-header/page-header';

/** Página temporal de un módulo aún no construido. Recibe `miga` e `icono` desde la data de la ruta. */
@Component({
  selector: 'hk-proximamente-page',
  imports: [RouterLink, TranslocoPipe, HkButton, HkCard, HkEmptyState, HkPageHeader],
  template: `
    <hk-page-header [titulo]="miga() | transloco" />
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
}
