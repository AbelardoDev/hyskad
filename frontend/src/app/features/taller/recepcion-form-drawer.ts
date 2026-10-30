import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize } from 'rxjs';

import { conFormulario } from '../../core/http/contexto-http';
import { HkButton } from '../../shared/ui/button/button';
import { HkDrawer } from '../../shared/ui/dialog/drawer';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkTextarea } from '../../shared/ui/forms/textarea';
import { Orden, OrdenesApiService } from './ordenes-api.service';

/** Corrige motivo, descripción y observaciones de una orden activa. Cierra con la orden guardada. */
@Component({
  selector: 'hk-recepcion-form-drawer',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkButton,
    HkDrawer,
    HkFormField,
    HkInput,
    HkTextarea,
  ],
  template: `
    <hk-drawer [titulo]="'taller.detalle.editar_recepcion' | transloco">
      <form
        id="form-recepcion"
        class="space-y-5"
        [formGroup]="form"
        (ngSubmit)="guardar()"
        novalidate
      >
        <hk-form-field [etiqueta]="'taller.campos.motivo' | transloco">
          <hk-input formControlName="motivoIngreso" autocompletar="off" [maxCaracteres]="200" />
        </hk-form-field>
        <hk-form-field [etiqueta]="'taller.campos.descripcion_problema' | transloco">
          <hk-textarea formControlName="descripcionProblema" [filas]="5" [maxCaracteres]="2000" />
        </hk-form-field>
        <hk-form-field [etiqueta]="'taller.campos.observaciones' | transloco" [opcional]="true">
          <hk-textarea formControlName="observaciones" [filas]="3" [maxCaracteres]="2000" />
        </hk-form-field>
      </form>
      <div hkDrawerPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button
          hk-button
          tipo="submit"
          form="form-recepcion"
          icono="check"
          [cargando]="guardando()"
        >
          {{ 'comun.guardar' | transloco }}
        </button>
      </div>
    </hk-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecepcionFormDrawer {
  private readonly api = inject(OrdenesApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Orden>>(DialogRef);
  private readonly orden = inject<Orden>(DIALOG_DATA);
  protected readonly guardando = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    motivoIngreso: [this.orden.motivoIngreso, [Validators.required, Validators.maxLength(200)]],
    descripcionProblema: [
      this.orden.descripcionProblema,
      [Validators.required, Validators.maxLength(2000)],
    ],
    observaciones: [this.orden.observaciones ?? '', Validators.maxLength(2000)],
  });

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.api
      .actualizar(
        this.orden,
        {
          motivoIngreso: v.motivoIngreso.trim(),
          descripcionProblema: v.descripcionProblema.trim(),
          observaciones: v.observaciones.trim() || null,
        },
        conFormulario(this.form),
      )
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe((guardada) => this.ref.close(guardada));
  }
}
