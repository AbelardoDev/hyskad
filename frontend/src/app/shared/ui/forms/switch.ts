import { ChangeDetectionStrategy, Component, computed, forwardRef, model } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { ControlBase } from './campo';

/** Interruptor (`role="switch"`). La etiqueta es el contenido proyectado. */
@Component({
  selector: 'hk-switch',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HkSwitch), multi: true }],
  template: `
    <span class="inline-flex min-h-11 items-center gap-3 md:min-h-0">
      <button
        type="button"
        role="switch"
        class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border hk-foco transition-colors duration-150 ease-hk disabled:cursor-not-allowed disabled:opacity-55"
        [class]="valor() ? 'border-primary bg-primary' : 'border-border-strong bg-surface-2'"
        [id]="idControl()"
        [attr.aria-checked]="valor()"
        [attr.aria-labelledby]="idEtiqueta()"
        [attr.aria-describedby]="descritoPor()"
        [disabled]="estaDeshabilitado()"
        (click)="actualizar(!valor())"
        (blur)="tocar()"
      >
        <span
          class="inline-block size-4.5 rounded-full shadow-sm transition-transform duration-150 ease-hk"
          [class]="valor() ? 'translate-x-5.5 bg-primary-fg' : 'translate-x-0.5 bg-muted'"
        ></span>
      </button>
      <label
        [id]="idEtiqueta()"
        [for]="idControl()"
        class="cursor-pointer text-sm text-fg"
        [class.cursor-not-allowed]="estaDeshabilitado()"
      >
        <ng-content />
      </label>
    </span>
  `,
  host: { class: 'inline-block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkSwitch extends ControlBase<boolean> {
  readonly valor = model(false);

  protected readonly idEtiqueta = computed(() => `${this.idControl()}-etiqueta`);
}
