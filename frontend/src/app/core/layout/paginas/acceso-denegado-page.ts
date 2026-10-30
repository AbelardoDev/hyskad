import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { HkButton } from '../../../shared/ui/button/button';
import { HkCard } from '../../../shared/ui/card/card';
import { HkEmptyState } from '../../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../../shared/ui/page-header/page-header';
import { NavegacionService } from '../navegacion.service';

/** 403: el usuario entró por URL a un módulo para el que no tiene permiso (`permisoGuard`). */
@Component({
  selector: 'hk-acceso-denegado-page',
  imports: [RouterLink, TranslocoPipe, HkButton, HkCard, HkEmptyState, HkPageHeader],
  template: `
    <hk-page-header [titulo]="'acceso_denegado.miga' | transloco" />
    <hk-card>
      <hk-empty-state
        icono="shield-x"
        [titulo]="'acceso_denegado.titulo' | transloco"
        [texto]="'acceso_denegado.texto' | transloco"
      >
        <a hk-button variante="secondary" icono="house" [routerLink]="navegacion.rutaInicio()">{{
          'comun.volver_inicio' | transloco
        }}</a>
      </hk-empty-state>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccesoDenegadoPage {
  protected readonly navegacion = inject(NavegacionService);
}
