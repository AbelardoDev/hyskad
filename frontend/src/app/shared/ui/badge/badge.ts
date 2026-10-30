import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

export type TonoBadge =
  'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export const CLASES_TONO: Record<TonoBadge, string> = {
  neutral: 'bg-surface-2 text-neutral-ink ring-border',
  primary: 'bg-primary-soft text-primary-ink ring-primary/20',
  success: 'bg-success-soft text-success-ink ring-success/20',
  warning: 'bg-warning-soft text-warning-ink ring-warning/25',
  danger: 'bg-danger-soft text-danger-ink ring-danger/20',
  info: 'bg-info-soft text-info-ink ring-info/20',
  accent: 'bg-accent-soft text-accent-ink ring-accent/25',
};

/** Etiqueta pequeña de estado o categoría. Si comunica un estado, usar ícono además del color. */
@Component({
  selector: 'hk-badge',
  imports: [LucideDynamicIcon],
  template: `
    @if (punto()) {
      <span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>
    } @else if (icono()) {
      <svg [lucideIcon]="icono()!" class="size-3.5" aria-hidden="true" />
    }
    <ng-content />
  `,
  host: { '[class]': 'clases()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkBadge {
  readonly tono = input<TonoBadge>('neutral');
  readonly icono = input<string>();
  readonly punto = input(false);

  protected readonly clases = computed(
    () =>
      'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ring-1 ring-inset ' +
      CLASES_TONO[this.tono()],
  );
}
