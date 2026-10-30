import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { ControlBase } from './campo';

export type TipoInput = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';

/** Campo de texto. Con `tipo="password"` agrega el botón mostrar/ocultar. */
@Component({
  selector: 'hk-input',
  imports: [LucideDynamicIcon, TranslocoPipe],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HkInput), multi: true }],
  template: `
    <div class="relative">
      @if (icono()) {
        <svg
          [lucideIcon]="icono()!"
          class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
      }
      <input
        class="hk-control"
        [class.pl-9]="icono()"
        [class.pr-11]="tipo() === 'password'"
        [id]="idControl()"
        [type]="tipoEfectivo()"
        [value]="valor() ?? ''"
        [placeholder]="placeholder() ?? ''"
        [attr.autocomplete]="autocompletar() ?? null"
        [attr.inputmode]="modoTeclado() ?? null"
        [attr.maxlength]="maxCaracteres() ?? null"
        [attr.aria-label]="etiquetaAccesible() ?? null"
        [disabled]="estaDeshabilitado()"
        [attr.aria-invalid]="invalido() || null"
        [attr.aria-describedby]="descritoPor()"
        [attr.aria-required]="requerido() || null"
        (input)="actualizar(texto($event))"
        (blur)="tocar()"
      />
      @if (tipo() === 'password') {
        <button
          type="button"
          class="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hk-foco transition-colors hover:text-fg"
          [attr.aria-label]="
            (visible() ? 'ui.input.ocultar_password' : 'ui.input.mostrar_password') | transloco
          "
          [attr.aria-pressed]="visible()"
          [attr.aria-controls]="idControl()"
          [disabled]="estaDeshabilitado()"
          (click)="visible.set(!visible())"
        >
          <svg [lucideIcon]="visible() ? 'eye-off' : 'eye'" class="size-4" aria-hidden="true" />
        </button>
      }
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkInput extends ControlBase<string | null> {
  readonly valor = model<string | null>(null);
  readonly tipo = input<TipoInput>('text');
  readonly placeholder = input<string>();
  readonly icono = input<string>();
  readonly autocompletar = input<string>();
  readonly modoTeclado = input<'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'search'>();
  readonly maxCaracteres = input<number>();
  /** Nombre accesible cuando el campo no tiene etiqueta visible (buscadores). */
  readonly etiquetaAccesible = input<string>();

  protected readonly visible = signal(false);
  protected readonly tipoEfectivo = computed(() =>
    this.tipo() === 'password' && this.visible() ? 'text' : this.tipo(),
  );
}
