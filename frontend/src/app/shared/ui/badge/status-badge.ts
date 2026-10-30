import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { HkBadge, TonoBadge } from './badge';

export type EstadoOrden =
  | 'RECIBIDA'
  | 'EN_DIAGNOSTICO'
  | 'PENDIENTE_APROBACION'
  | 'EN_REPARACION'
  | 'FINALIZADA'
  | 'ENTREGADA'
  | 'CANCELADA';

/** Color e ícono de cada estado de orden (DESIGN-SYSTEM §1.3). */
export const ESTILO_ESTADO_ORDEN: Record<EstadoOrden, { tono: TonoBadge; icono: string }> = {
  RECIBIDA: { tono: 'neutral', icono: 'inbox' },
  EN_DIAGNOSTICO: { tono: 'info', icono: 'stethoscope' },
  PENDIENTE_APROBACION: { tono: 'warning', icono: 'hourglass' },
  EN_REPARACION: { tono: 'primary', icono: 'wrench' },
  FINALIZADA: { tono: 'accent', icono: 'circle-check' },
  ENTREGADA: { tono: 'success', icono: 'package-check' },
  CANCELADA: { tono: 'danger', icono: 'circle-x' },
};

/** Estado de una orden de trabajo: siempre ícono + texto, nunca solo color. */
@Component({
  selector: 'hk-status-badge',
  imports: [HkBadge, TranslocoPipe],
  template: `
    <hk-badge [tono]="estilo().tono" [icono]="estilo().icono">{{
      'estados.orden.' + estado() | transloco
    }}</hk-badge>
  `,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkStatusBadge {
  readonly estado = input.required<EstadoOrden>();

  protected readonly estilo = computed(() => ESTILO_ESTADO_ORDEN[this.estado()]);
}
