import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

export type VarianteBotonIcono = 'ghost' | 'secondary' | 'primary' | 'danger';

const VARIANTES: Record<VarianteBotonIcono, string> = {
  ghost: 'text-muted hover:not-disabled:bg-surface-2 hover:not-disabled:text-fg',
  secondary: 'border border-border bg-surface text-fg hover:not-disabled:bg-surface-2',
  primary: 'bg-primary text-primary-fg hover:not-disabled:bg-primary-hover',
  danger: 'text-danger hover:not-disabled:bg-danger-soft',
};

/** Botón de solo ícono. `etiqueta` es obligatoria: es el nombre accesible (`aria-label`). */
@Component({
  selector: 'button[hk-icon-button]',
  imports: [LucideDynamicIcon],
  template: `<svg [lucideIcon]="icono()" aria-hidden="true" /><ng-content />`,
  host: {
    type: 'button',
    '[attr.aria-label]': 'etiqueta()',
    '[attr.disabled]': 'deshabilitado() ? "" : null',
    '[class]': 'clases()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkIconButton {
  readonly icono = input.required<string>();
  readonly etiqueta = input.required<string>();
  readonly variante = input<VarianteBotonIcono>('ghost');
  readonly tamano = input<'sm' | 'md'>('md');
  readonly deshabilitado = input(false, { transform: booleanAttribute });

  protected readonly clases = computed(() =>
    [
      'relative inline-flex shrink-0 items-center justify-center rounded-xl transition-colors duration-150 ease-hk hk-foco',
      'disabled:cursor-not-allowed disabled:opacity-55',
      this.tamano() === 'sm' ? 'size-8 [&>svg]:size-4' : 'size-10 [&>svg]:size-5 max-md:size-11',
      VARIANTES[this.variante()],
    ].join(' '),
  );
}
