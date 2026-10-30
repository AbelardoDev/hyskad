import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';

/** Aviso dentro de un formulario de acceso (error del servidor o confirmación), anunciado. */
@Component({
  selector: 'hk-aviso-formulario',
  imports: [LucideDynamicIcon],
  template: `
    <svg
      [lucideIcon]="tipo() === 'error' ? 'circle-alert' : 'circle-check'"
      class="mt-0.5 size-4 shrink-0"
      aria-hidden="true"
    />
    <div class="min-w-0 flex-1"><ng-content /></div>
  `,
  host: {
    role: 'alert',
    class: 'flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm',
    '[class]':
      "tipo() === 'error' ? 'bg-danger-soft text-danger-ink' : 'bg-success-soft text-success-ink'",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkAvisoFormulario {
  readonly tipo = input<'error' | 'exito'>('error');
}
