import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { fortalezaPassword, reglasPassword } from '../../../core/utils/validadores';

const NIVELES = ['vacia', 'debil', 'aceptable', 'fuerte'] as const;
const COLOR_NIVEL = ['bg-border', 'bg-danger', 'bg-warning', 'bg-success'] as const;
const REGLAS = ['longitud', 'letras', 'numeros'] as const;

/** Medidor de fortaleza bajo un campo de contraseña nueva: barra de 3 tramos y la política. */
@Component({
  selector: 'hk-medidor-password',
  imports: [TranslocoPipe, LucideDynamicIcon],
  template: `
    <div class="flex items-center gap-3">
      <div class="grid flex-1 grid-cols-3 gap-1.5" aria-hidden="true">
        @for (tramo of [1, 2, 3]; track tramo) {
          <span
            class="h-1.5 rounded-full transition-colors duration-200"
            [class]="nivel() >= tramo ? color() : 'bg-border'"
          ></span>
        }
      </div>
      <p class="min-w-20 text-right text-xs font-medium text-muted" aria-live="polite">
        @if (nivel() > 0) {
          {{ 'ui.password.' + nombreNivel() | transloco }}
        }
      </p>
    </div>
    <ul class="mt-2 grid gap-1 text-xs sm:grid-cols-3">
      @for (regla of reglas; track regla) {
        <li
          class="flex items-center gap-1.5"
          [class]="cumple()[regla] ? 'text-success' : 'text-muted'"
        >
          <svg
            [lucideIcon]="cumple()[regla] ? 'circle-check' : 'circle'"
            class="size-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>
            {{ 'ui.password.regla_' + regla | transloco }}
            <span class="sr-only">{{
              (cumple()[regla] ? 'ui.password.cumplida' : 'ui.password.pendiente') | transloco
            }}</span>
          </span>
        </li>
      }
    </ul>
  `,
  host: { class: 'mt-2 block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkMedidorPassword {
  readonly valor = input<string | null>(null);

  protected readonly reglas = REGLAS;
  protected readonly nivel = computed(() => fortalezaPassword(this.valor() ?? ''));
  protected readonly nombreNivel = computed(() => NIVELES[this.nivel()]);
  protected readonly color = computed(() => COLOR_NIVEL[this.nivel()]);
  protected readonly cumple = computed(() => reglasPassword(this.valor() ?? ''));
}
