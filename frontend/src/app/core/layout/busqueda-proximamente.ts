import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { HkModal } from '../../shared/ui/dialog/modal';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';

/** Marcador del buscador global (`Ctrl/⌘ + K`) hasta que llegue hk-command-palette (F11). */
@Component({
  selector: 'hk-busqueda-proximamente',
  imports: [HkModal, HkEmptyState, TranslocoPipe],
  template: `
    <hk-modal [titulo]="'layout.buscar_etiqueta' | transloco">
      <hk-empty-state
        compacto
        icono="search"
        [titulo]="'layout.buscar_proximamente' | transloco"
        [texto]="'layout.buscar_proximamente_texto' | transloco"
      />
    </hk-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusquedaProximamente {}
