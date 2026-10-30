import { ChangeDetectionStrategy, Component, forwardRef, input, model } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideDynamicIcon } from '@lucide/angular';

import { ControlBase } from './campo';

export interface OpcionSelect {
  valor: string;
  /** Texto ya traducido. */
  etiqueta: string;
  deshabilitada?: boolean;
}

/** Lista desplegable nativa (accesible y cómoda en móvil) con el estilo del kit. */
@Component({
  selector: 'hk-select',
  imports: [LucideDynamicIcon],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HkSelect), multi: true }],
  template: `
    <div class="relative">
      <select
        class="hk-control cursor-pointer appearance-none pr-10"
        [class.text-muted]="!valor()"
        [id]="idControl()"
        [disabled]="estaDeshabilitado()"
        [attr.aria-invalid]="invalido() || null"
        [attr.aria-describedby]="descritoPor()"
        [attr.aria-required]="requerido() || null"
        (change)="actualizar(texto($event) || null)"
        (blur)="tocar()"
      >
        @if (placeholder()) {
          <option value="" [selected]="!valor()">{{ placeholder() }}</option>
        }
        @for (opcion of opciones(); track opcion.valor) {
          <option
            class="text-fg"
            [value]="opcion.valor"
            [selected]="opcion.valor === valor()"
            [disabled]="opcion.deshabilitada"
          >
            {{ opcion.etiqueta }}
          </option>
        }
      </select>
      <svg
        lucideIcon="chevron-down"
        class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkSelect extends ControlBase<string | null> {
  readonly valor = model<string | null>(null);
  readonly opciones = input<readonly OpcionSelect[]>([]);
  readonly placeholder = input<string>();
}
