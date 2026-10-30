import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';

import { igualA, passwordSegura } from '../../../core/utils/validadores';
import { HkFormField } from './form-field';
import { HkInput } from './input';
import { HkMedidorPassword } from './medidor-password';

export type GrupoPasswordNueva = FormGroup<{
  nueva: FormControl<string>;
  confirmar: FormControl<string>;
}>;

/** Grupo "contraseña nueva + confirmación" con la política del backend. */
export function grupoPasswordNueva(fb: NonNullableFormBuilder): GrupoPasswordNueva {
  const grupo = fb.group({
    nueva: ['', [Validators.required, passwordSegura]],
    confirmar: [''],
  });
  const { nueva, confirmar } = grupo.controls;
  confirmar.addValidators([Validators.required, igualA(() => nueva)]);
  nueva.valueChanges.subscribe(() => {
    if (confirmar.value) confirmar.updateValueAndValidity();
  });
  return grupo;
}

/** Campos de contraseña nueva (con medidor de fortaleza) y su confirmación. */
@Component({
  selector: 'hk-campos-password-nueva',
  imports: [ReactiveFormsModule, TranslocoPipe, HkFormField, HkInput, HkMedidorPassword],
  template: `
    <div class="space-y-5" [formGroup]="grupo()">
      <div>
        <hk-form-field [etiqueta]="'ui.password.nueva' | transloco">
          <hk-input
            formControlName="nueva"
            tipo="password"
            autocompletar="new-password"
            [maxCaracteres]="72"
          />
        </hk-form-field>
        <hk-medidor-password [valor]="grupo().controls.nueva.value" />
      </div>
      <hk-form-field [etiqueta]="'ui.password.confirmar' | transloco">
        <hk-input
          formControlName="confirmar"
          tipo="password"
          autocompletar="new-password"
          [maxCaracteres]="72"
        />
      </hk-form-field>
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkCamposPasswordNueva {
  readonly grupo = input.required<GrupoPasswordNueva>();
}
