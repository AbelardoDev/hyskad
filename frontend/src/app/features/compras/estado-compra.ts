import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { HkBadge } from '../../shared/ui/badge/badge';
import { EstadoCompra } from './compras-api.service';

/** Badge del estado de una compra: registrada o anulada. */
@Component({
  selector: 'hk-estado-compra',
  imports: [TranslocoPipe, HkBadge],
  template: `
    <hk-badge
      [tono]="estado() === 'REGISTRADA' ? 'success' : 'danger'"
      [icono]="estado() === 'REGISTRADA' ? 'circle-check' : 'circle-x'"
    >
      {{ 'compras.estados.' + estado() | transloco }}
    </hk-badge>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkEstadoCompra {
  readonly estado = input.required<EstadoCompra>();
}
