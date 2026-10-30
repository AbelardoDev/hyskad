import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { normalizarPlaca } from '../../../core/utils/validadores';

const TAMANOS = {
  sm: 'px-1.5 py-0.5 text-xs border',
  md: 'px-2 py-0.5 text-sm border-2',
  lg: 'px-3 py-1 text-xl border-2',
} as const;

/**
 * Placa estilizada (DESIGN-SYSTEM §7): fondo amarillo suave, monoespaciada y borde oscuro.
 * Separa letras y números como la placa física: `ABC12D` → `ABC 12D`, `123ABC` → `123 ABC`.
 */
@Component({
  selector: 'hk-placa',
  template: `{{ texto() }}`,
  host: {
    class:
      'inline-flex shrink-0 items-center rounded-md border-placa-borde bg-placa font-mono font-bold tracking-wider whitespace-nowrap text-placa-fg uppercase',
    '[class]': 'clases()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkPlaca {
  readonly placa = input.required<string>();
  readonly tamano = input<keyof typeof TAMANOS>('md');

  protected readonly clases = computed(() => TAMANOS[this.tamano()]);
  protected readonly texto = computed(() => {
    const placa = normalizarPlaca(this.placa());
    return placa.length >= 5 ? `${placa.slice(0, 3)} ${placa.slice(3)}` : placa;
  });
}
