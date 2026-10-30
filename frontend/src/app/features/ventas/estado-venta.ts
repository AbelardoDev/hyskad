import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { HkBadge } from '../../shared/ui/badge/badge';
import { EstadoVenta } from './ventas-api.service';

/** Badge del estado de una venta: pagada o anulada. */
@Component({
  selector: 'hk-estado-venta',
  imports: [TranslocoPipe, HkBadge],
  template: `
    <hk-badge
      [tono]="estado() === 'PAGADA' ? 'success' : 'danger'"
      [icono]="estado() === 'PAGADA' ? 'circle-check' : 'circle-x'"
    >
      {{ 'ventas.estados.' + estado() | transloco }}
    </hk-badge>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkEstadoVenta {
  readonly estado = input.required<EstadoVenta>();
}
