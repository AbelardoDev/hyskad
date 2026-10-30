import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  input,
  model,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideDynamicIcon } from '@lucide/angular';

import { ControlBase } from './campo';

/** Casilla de verificación. La etiqueta es el contenido proyectado. */
@Component({
  selector: 'hk-checkbox',
  imports: [LucideDynamicIcon],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HkCheckbox), multi: true },
  ],
  template: `
    <label
      class="group inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-fg md:min-h-0"
      [class.cursor-not-allowed]="estaDeshabilitado()"
      [class.opacity-60]="estaDeshabilitado()"
    >
      <span class="relative inline-flex size-5 shrink-0">
        <input
          type="checkbox"
          class="peer size-5 cursor-pointer appearance-none rounded-md border border-border-strong bg-surface hk-foco transition-colors duration-150 checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary disabled:cursor-not-allowed aria-invalid:border-danger"
          [id]="idControl()"
          [checked]="valor()"
          [indeterminate]="indeterminado()"
          [disabled]="estaDeshabilitado()"
          [attr.aria-label]="etiquetaAccesible() ?? null"
          [attr.aria-invalid]="invalido() || null"
          [attr.aria-describedby]="descritoPor()"
          (change)="actualizar(marcado($event))"
          (blur)="tocar()"
        />
        <svg
          lucideIcon="check"
          [strokeWidth]="3"
          class="pointer-events-none absolute inset-0.5 size-4 text-primary-fg opacity-0 peer-checked:opacity-100"
          aria-hidden="true"
        />
        @if (indeterminado()) {
          <span
            class="pointer-events-none absolute top-1/2 left-1 h-0.5 w-3 -translate-y-1/2 rounded bg-primary-fg"
          ></span>
        }
      </span>
      <ng-content />
    </label>
  `,
  host: { class: 'inline-block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkCheckbox extends ControlBase<boolean> {
  readonly valor = model(false);
  readonly indeterminado = input(false, { transform: booleanAttribute });
  /** Para casillas sin texto visible (p. ej. seleccionar fila en una tabla). */
  readonly etiquetaAccesible = input<string>();

  protected marcado(evento: Event): boolean {
    return (evento.target as HTMLInputElement).checked;
  }
}
