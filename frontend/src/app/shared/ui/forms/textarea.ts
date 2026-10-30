import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { ControlBase } from './campo';

/** Área de texto con contador opcional de caracteres. */
@Component({
  selector: 'hk-textarea',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HkTextarea), multi: true },
  ],
  template: `
    <textarea
      class="hk-control resize-y py-2.5 leading-relaxed"
      [id]="idControl()"
      [rows]="filas()"
      [value]="valor() ?? ''"
      [placeholder]="placeholder() ?? ''"
      [attr.maxlength]="maxCaracteres() ?? null"
      [disabled]="estaDeshabilitado()"
      [attr.aria-invalid]="invalido() || null"
      [attr.aria-describedby]="descritoPor()"
      [attr.aria-required]="requerido() || null"
      (input)="actualizar(texto($event))"
      (blur)="tocar()"
    ></textarea>
    @if (maxCaracteres()) {
      <p class="mt-1 text-right text-xs text-muted tabular" aria-hidden="true">{{ contador() }}</p>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkTextarea extends ControlBase<string | null> {
  readonly valor = model<string | null>(null);
  readonly filas = input(4);
  readonly placeholder = input<string>();
  readonly maxCaracteres = input<number>();

  protected readonly contador = computed(
    () => `${this.valor()?.length ?? 0} / ${this.maxCaracteres()}`,
  );
}
