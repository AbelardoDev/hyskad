import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

/** Estado vacío: ícono grande en círculo degradado, título, texto y acción proyectada. */
@Component({
  selector: 'hk-empty-state',
  imports: [LucideDynamicIcon],
  template: `
    <div
      class="relative mb-5 inline-flex items-center justify-center rounded-full bg-linear-to-br from-brand-400 to-brand-800 text-brand-50 shadow-[0_12px_32px_-12px] ring-8 shadow-brand-600/60 ring-primary-soft"
      [class]="compacto() ? 'size-12' : 'size-18'"
    >
      <svg
        [lucideIcon]="icono()"
        [class]="compacto() ? 'size-5' : 'size-8'"
        [strokeWidth]="1.75"
        aria-hidden="true"
      />
      <span
        class="absolute top-1 right-1 size-2.5 rounded-full bg-accent ring-2 ring-surface"
        aria-hidden="true"
      ></span>
    </div>
    <h2
      class="font-display font-semibold text-fg"
      [class]="compacto() ? 'text-base' : 'text-xl tracking-tight'"
    >
      {{ titulo() }}
    </h2>
    @if (texto()) {
      <p class="mt-2 max-w-md text-sm text-balance text-muted">{{ texto() }}</p>
    }
    <div class="mt-6 flex flex-wrap justify-center gap-3 empty:hidden">
      <ng-content />
    </div>
  `,
  host: {
    class: 'flex flex-col items-center justify-center text-center animate-entrada',
    '[class.py-16]': '!compacto()',
    '[class.py-8]': 'compacto()',
    '[class.px-4]': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkEmptyState {
  readonly icono = input('inbox');
  readonly titulo = input.required<string>();
  readonly texto = input<string>();
  readonly compacto = input(false, { transform: booleanAttribute });
}
