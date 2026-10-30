import { ChangeDetectionStrategy, Component, forwardRef, input, model } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { ControlBase } from './campo';

/**
 * Fecha con el selector nativo del navegador (accesible y adaptado a cada plataforma).
 * El valor es una fecha ISO `AAAA-MM-DD` o `null`, igual que `LocalDate` en el backend.
 */
@Component({
  selector: 'hk-date-input',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HkDateInput), multi: true },
  ],
  template: `
    <input
      type="date"
      class="hk-control tabular [&::-webkit-calendar-picker-indicator]:cursor-pointer dark:[&::-webkit-calendar-picker-indicator]:invert"
      [id]="idControl()"
      [value]="valor() ?? ''"
      [attr.min]="min() ?? null"
      [attr.max]="max() ?? null"
      [disabled]="estaDeshabilitado()"
      [attr.aria-invalid]="invalido() || null"
      [attr.aria-describedby]="descritoPor()"
      [attr.aria-required]="requerido() || null"
      (change)="actualizar(texto($event) || null)"
      (blur)="tocar()"
    />
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkDateInput extends ControlBase<string | null> {
  readonly valor = model<string | null>(null);
  readonly min = input<string>();
  readonly max = input<string>();
}
