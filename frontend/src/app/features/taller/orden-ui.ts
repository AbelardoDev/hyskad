import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { HkAvatar } from '../../shared/ui/avatar/avatar';
import { EstadoOrden } from '../../shared/ui/badge/status-badge';
import { VarianteBoton } from '../../shared/ui/button/button';
import { HkTooltipDirective } from '../../shared/ui/tooltip/tooltip';
import { UsuarioResumen } from './ordenes-api.service';

export interface AccionTransicion {
  /** Clave bajo `taller.acciones`. */
  clave: string;
  icono: string;
  variante: VarianteBoton;
}

/**
 * Cómo se muestra el botón de una transición. El mismo destino tiene nombres distintos según el
 * origen (volver a diagnóstico es "iniciar", "retirar presupuesto" o "requiere ajuste").
 */
export function accionTransicion(desde: EstadoOrden, hasta: EstadoOrden): AccionTransicion {
  switch (hasta) {
    case 'EN_DIAGNOSTICO':
      if (desde === 'RECIBIDA')
        return { clave: 'iniciar_diagnostico', icono: 'stethoscope', variante: 'primary' };
      return desde === 'EN_REPARACION'
        ? { clave: 'requiere_ajuste', icono: 'undo-2', variante: 'secondary' }
        : { clave: 'retirar_presupuesto', icono: 'undo-2', variante: 'secondary' };
    case 'PENDIENTE_APROBACION':
      return { clave: 'enviar_presupuesto', icono: 'hourglass', variante: 'primary' };
    case 'EN_REPARACION':
      return { clave: 'iniciar_reparacion', icono: 'wrench', variante: 'primary' };
    case 'FINALIZADA':
      return { clave: 'finalizar', icono: 'circle-check', variante: 'primary' };
    case 'ENTREGADA':
      return { clave: 'entregar', icono: 'package-check', variante: 'primary' };
    case 'CANCELADA':
      return { clave: 'cancelar', icono: 'circle-x', variante: 'danger' };
    default:
      return { clave: 'recibir', icono: 'inbox', variante: 'secondary' };
  }
}

/** Avatares de los mecánicos de una orden (máximo 3 y "+N"); sin mecánicos muestra un guion. */
@Component({
  selector: 'hk-mecanicos-avatares',
  imports: [HkAvatar, HkTooltipDirective],
  template: `
    @if (mecanicos().length === 0) {
      <span class="text-muted">—</span>
    } @else {
      <span class="flex -space-x-2">
        @for (m of visibles(); track m.id) {
          <hk-avatar
            class="ring-2 ring-surface"
            tamano="sm"
            [nombre]="m.nombre"
            [hkTooltip]="m.nombre"
          />
        }
        @if (resto() > 0) {
          <span
            class="inline-flex size-7 items-center justify-center rounded-full bg-surface-2 text-[0.6875rem] font-semibold text-muted ring-2 ring-surface"
            >+{{ resto() }}</span
          >
        }
      </span>
    }
  `,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkMecanicosAvatares {
  readonly mecanicos = input.required<readonly UsuarioResumen[]>();

  protected readonly visibles = computed(() => this.mecanicos().slice(0, 3));
  protected readonly resto = computed(() => this.mecanicos().length - 3);
}
