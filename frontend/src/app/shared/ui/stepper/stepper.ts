import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

export interface Paso {
  id: string;
  /** Texto ya traducido. */
  etiqueta: string;
  icono?: string;
  /** Detalle bajo la etiqueta (fecha y usuario de la transición, por ejemplo). */
  detalle?: string;
}

type EstadoPaso = 'completado' | 'actual' | 'pendiente' | 'cancelado';

/**
 * Línea de tiempo de pasos (estado de la orden). Horizontal en escritorio, vertical en móvil.
 * `cancelado` marca el paso actual en rojo (orden cancelada).
 */
@Component({
  selector: 'hk-stepper',
  imports: [LucideDynamicIcon, TranslocoPipe],
  template: `
    <ol class="flex flex-col gap-0 md:flex-row" [attr.aria-label]="etiqueta() ?? null">
      @for (paso of pasos(); track paso.id; let i = $index; let ultimo = $last) {
        @let estado = estados()[i];
        <li
          class="relative flex flex-1 gap-3 pb-6 last:pb-0 md:flex-col md:items-center md:pb-0 md:text-center"
          [attr.aria-current]="estado === 'actual' || estado === 'cancelado' ? 'step' : null"
        >
          @if (!ultimo) {
            <span
              class="absolute top-9 bottom-0 left-[1.0625rem] w-0.5 md:top-[1.0625rem] md:right-[calc(-50%+1.25rem)] md:bottom-auto md:left-[calc(50%+1.25rem)] md:h-0.5 md:w-auto"
              [class]="estado === 'completado' ? 'bg-primary' : 'bg-border'"
              aria-hidden="true"
            ></span>
          }
          <span
            class="relative z-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
            [class]="claseCirculo(estado)"
          >
            @switch (estado) {
              @case ('completado') {
                <svg lucideIcon="check" class="size-4" [strokeWidth]="3" aria-hidden="true" />
              }
              @case ('cancelado') {
                <svg lucideIcon="x" class="size-4" [strokeWidth]="3" aria-hidden="true" />
              }
              @default {
                @if (paso.icono) {
                  <svg [lucideIcon]="paso.icono" class="size-4" aria-hidden="true" />
                } @else {
                  <span class="text-xs font-semibold tabular">{{ i + 1 }}</span>
                }
              }
            }
            @if (estado === 'actual') {
              <span
                class="absolute -top-0.5 -right-0.5 size-2.5 animate-pulso rounded-full bg-accent ring-2 ring-surface"
                aria-hidden="true"
              ></span>
            }
          </span>
          <div class="min-w-0 pt-1.5 md:px-2 md:pt-2.5">
            <p
              class="text-sm font-medium"
              [class]="estado === 'pendiente' ? 'text-muted' : 'text-fg'"
            >
              {{ paso.etiqueta }}
              <span class="sr-only">({{ 'ui.stepper.' + estado | transloco }})</span>
            </p>
            @if (paso.detalle) {
              <p class="mt-0.5 text-xs text-muted">{{ paso.detalle }}</p>
            }
          </div>
        </li>
      }
    </ol>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkStepper {
  readonly pasos = input.required<readonly Paso[]>();
  readonly actual = input.required<string>();
  readonly cancelado = input(false);
  readonly etiqueta = input<string>();

  protected readonly estados = computed<EstadoPaso[]>(() => {
    const indiceActual = this.pasos().findIndex((p) => p.id === this.actual());
    return this.pasos().map((_, i) => {
      if (i < indiceActual) return 'completado';
      if (i === indiceActual) return this.cancelado() ? 'cancelado' : 'actual';
      return 'pendiente';
    });
  });

  protected claseCirculo(estado: EstadoPaso): string {
    switch (estado) {
      case 'completado':
        return 'border-primary bg-primary text-primary-fg';
      case 'actual':
        return 'border-primary bg-primary-soft text-primary-ink';
      case 'cancelado':
        return 'border-danger bg-danger-soft text-danger-ink';
      default:
        return 'border-border bg-surface text-muted';
    }
  }
}
