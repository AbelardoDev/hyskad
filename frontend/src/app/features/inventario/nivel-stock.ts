import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { CantidadPipe } from '../../core/utils/formato.pipes';
import { HkBadge, TonoBadge } from '../../shared/ui/badge/badge';
import { EstadoStock, Producto } from './inventario-api.service';

const TONOS: Record<EstadoStock, TonoBadge> = { OK: 'success', BAJO: 'warning', AGOTADO: 'danger' };
const ICONOS: Record<EstadoStock, string> = {
  OK: 'circle-check',
  BAJO: 'triangle-alert',
  AGOTADO: 'circle-x',
};
const BARRAS: Record<EstadoStock, string> = {
  OK: 'bg-success',
  BAJO: 'bg-warning',
  AGOTADO: 'bg-danger',
};

/** Badge del estado de stock (ok, bajo, agotado). */
@Component({
  selector: 'hk-estado-stock',
  imports: [TranslocoPipe, HkBadge],
  template: `
    <hk-badge [tono]="tono()" [icono]="icono()">
      {{ 'inventario.estado_stock.' + estado() | transloco }}
    </hk-badge>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkEstadoStock {
  readonly estado = input.required<EstadoStock>();
  protected readonly tono = computed(() => TONOS[this.estado()]);
  protected readonly icono = computed(() => ICONOS[this.estado()]);
}

/**
 * Disponible con una barra de nivel frente al mínimo: la barra llena equivale al doble del
 * mínimo (o al disponible si no hay mínimo), y su color sigue el estado del stock.
 */
@Component({
  selector: 'hk-nivel-stock',
  imports: [TranslocoPipe, CantidadPipe],
  template: `
    <div class="flex min-w-24 flex-col gap-1">
      <span class="text-sm font-medium text-fg tabular">
        {{ producto().stockDisponible | cantidad }}
        <span class="text-xs font-normal text-muted">
          {{ 'inventario.unidades_corto.' + producto().unidad | transloco }}
        </span>
      </span>
      <span
        class="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="meter"
        [attr.aria-label]="
          'inventario.nivel_accesible' | transloco: { minimo: producto().stockMinimo }
        "
        aria-valuemin="0"
        [attr.aria-valuemax]="tope()"
        [attr.aria-valuenow]="producto().stockDisponible"
      >
        <span
          class="block h-full rounded-full"
          [class]="barra()"
          [style.width.%]="porcentaje()"
        ></span>
      </span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkNivelStock {
  readonly producto =
    input.required<Pick<Producto, 'stockDisponible' | 'stockMinimo' | 'unidad' | 'estadoStock'>>();

  protected readonly tope = computed(() => {
    const { stockMinimo, stockDisponible } = this.producto();
    return stockMinimo > 0 ? stockMinimo * 2 : Math.max(stockDisponible, 1);
  });
  protected readonly porcentaje = computed(() =>
    Math.max(0, Math.min(100, (this.producto().stockDisponible / this.tope()) * 100)),
  );
  protected readonly barra = computed(() => BARRAS[this.producto().estadoStock]);
}
