import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { CantidadPipe, CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { ES_ENTRADA, Movimiento, TipoMovimiento } from './inventario-api.service';

/** Ícono y color de cada tipo: entradas en verde, salidas en rojo, ajustes y devoluciones aparte. */
export const ESTILO_MOVIMIENTO: Record<TipoMovimiento, { icono: string; clases: string }> = {
  ENTRADA_COMPRA: { icono: 'arrow-down-to-line', clases: 'bg-success-soft text-success-ink' },
  ENTRADA_AJUSTE: { icono: 'sliders-horizontal', clases: 'bg-success-soft text-success-ink' },
  DEVOLUCION_ANULACION_VENTA: { icono: 'undo-2', clases: 'bg-info-soft text-info-ink' },
  SALIDA_VENTA: { icono: 'shopping-cart', clases: 'bg-danger-soft text-danger-ink' },
  SALIDA_ORDEN: { icono: 'wrench', clases: 'bg-warning-soft text-warning-ink' },
  SALIDA_AJUSTE: { icono: 'sliders-horizontal', clases: 'bg-danger-soft text-danger-ink' },
  SALIDA_ANULACION_COMPRA: {
    icono: 'arrow-up-from-line',
    clases: 'bg-danger-soft text-danger-ink',
  },
};

/** Línea de tiempo de movimientos de un producto (kárdex), del más reciente al más antiguo. */
@Component({
  selector: 'hk-linea-movimientos',
  imports: [TranslocoPipe, LucideDynamicIcon, CantidadPipe, CopPipe, FechaPipe],
  template: `
    <ol class="relative">
      @for (m of movimientos(); track m.id; let ultimo = $last) {
        <li class="relative flex gap-4 pb-6 last:pb-0">
          @if (!ultimo) {
            <span class="absolute top-10 bottom-0 left-5 w-px bg-border" aria-hidden="true"></span>
          }
          <span
            class="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full"
            [class]="estilos[m.tipo].clases"
            aria-hidden="true"
          >
            <svg [lucideIcon]="estilos[m.tipo].icono" class="size-4.5" />
          </span>
          <div class="min-w-0 flex-1 pt-0.5">
            <div class="flex flex-wrap items-baseline justify-between gap-x-3">
              <p class="font-medium text-fg">{{ 'inventario.tipos.' + m.tipo | transloco }}</p>
              <p
                class="font-semibold tabular"
                [class]="entrada[m.tipo] ? 'text-success-ink' : 'text-danger-ink'"
              >
                {{ entrada[m.tipo] ? '+' : '−' }}{{ m.cantidad | cantidad }}
              </p>
            </div>
            <p class="mt-0.5 text-xs text-muted">
              {{ m.fecha | fecha: 'fechaHora' }}
              @if (m.usuario) {
                · {{ m.usuario.nombre }}
              }
              @if (m.referencia?.numero) {
                · {{ m.referencia!.numero }}
              }
            </p>
            @if (m.motivo) {
              <p class="mt-1 text-sm text-fg">{{ m.motivo }}</p>
            }
            <p class="mt-1 text-xs text-muted">
              {{
                'inventario.movimientos.detalle'
                  | transloco
                    : { stock: (m.stockResultante | cantidad), costo: (m.costoUnitario | cop) }
              }}
            </p>
          </div>
        </li>
      }
    </ol>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkLineaMovimientos {
  readonly movimientos = input.required<readonly Movimiento[]>();
  protected readonly estilos = ESTILO_MOVIMIENTO;
  protected readonly entrada = ES_ENTRADA;
}
