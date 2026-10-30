import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { LanguageService } from '../../../core/i18n/language.service';
import { formatoMiles } from '../../../core/utils/formato';
import { ControlBase } from './campo';

/** Máximo de DECIMAL(15,2): 13 dígitos enteros. */
const MAX_DIGITOS = 13;

/**
 * Monto en pesos colombianos (enteros). Muestra separadores de miles mientras se escribe
 * ("1.250.000") y entrega un número o `null`.
 */
@Component({
  selector: 'hk-money-input',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HkMoneyInput), multi: true },
  ],
  template: `
    <div class="relative">
      <span
        class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted"
        aria-hidden="true"
        >$</span
      >
      <input
        type="text"
        inputmode="numeric"
        autocomplete="off"
        class="hk-control pr-14 pl-7 text-right tabular"
        [id]="idControl()"
        [value]="textoVisible()"
        [placeholder]="placeholder() ?? '0'"
        [disabled]="estaDeshabilitado()"
        [attr.aria-invalid]="invalido() || null"
        [attr.aria-describedby]="descritoPor()"
        [attr.aria-required]="requerido() || null"
        (input)="alEscribir($event)"
        (blur)="tocar()"
      />
      <span
        class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium text-muted"
        aria-hidden="true"
        >COP</span
      >
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkMoneyInput extends ControlBase<number | null> {
  private readonly idioma = inject(LanguageService);

  readonly valor = model<number | null>(null);
  readonly placeholder = input<string>();

  protected readonly textoVisible = computed(() => {
    const valor = this.valor();
    return valor === null || valor === undefined ? '' : formatoMiles(valor, this.idioma.locale());
  });

  protected alEscribir(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const digitos = campo.value
      .replace(/\D/g, '')
      .replace(/^0+(?=\d)/, '')
      .slice(0, MAX_DIGITOS);
    const valor = digitos === '' ? null : Number(digitos);
    // Conserva la posición del cursor contando dígitos, no caracteres (los separadores cambian).
    const digitosAntesDelCursor = campo.value
      .slice(0, campo.selectionStart ?? 0)
      .replace(/\D/g, '').length;
    this.actualizar(valor);
    const formateado = valor === null ? '' : formatoMiles(valor, this.idioma.locale());
    campo.value = formateado;
    let posicion = 0;
    for (
      let vistos = 0;
      posicion < formateado.length && vistos < digitosAntesDelCursor;
      posicion++
    ) {
      if (/\d/.test(formateado[posicion])) vistos++;
    }
    campo.setSelectionRange(posicion, posicion);
  }
}
