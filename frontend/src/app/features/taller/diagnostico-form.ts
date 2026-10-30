import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize } from 'rxjs';

import { conFormulario } from '../../core/http/contexto-http';
import { HkButton } from '../../shared/ui/button/button';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkTextarea } from '../../shared/ui/forms/textarea';
import { MAX_KILOMETRAJE, Orden, OrdenesApiService } from './ordenes-api.service';

/**
 * Diagnóstico de la orden (RF14). Editable solo si `accionesPermitidas.registrarDiagnostico`
 * (en diagnóstico o en reparación); si no, se muestra de solo lectura. El kilometraje de
 * inspección es opcional y no baja del de ingreso.
 */
@Component({
  selector: 'hk-diagnostico-form',
  imports: [ReactiveFormsModule, TranslocoPipe, HkButton, HkFormField, HkInput, HkTextarea],
  template: `
    @if (orden().accionesPermitidas.registrarDiagnostico) {
      <form class="space-y-5" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <hk-form-field [etiqueta]="'taller.campos.diagnostico' | transloco">
          <hk-textarea formControlName="diagnostico" [filas]="6" [maxCaracteres]="4000" />
        </hk-form-field>
        <hk-form-field
          [etiqueta]="'taller.campos.observaciones_diagnostico' | transloco"
          [opcional]="true"
        >
          <hk-textarea formControlName="observaciones" [filas]="3" [maxCaracteres]="2000" />
        </hk-form-field>
        <hk-form-field
          class="sm:max-w-xs"
          [etiqueta]="'taller.campos.kilometraje_inspeccion' | transloco"
          [ayuda]="'taller.diagnostico.km_ayuda' | transloco: { km: orden().kilometrajeIngreso }"
          [opcional]="true"
        >
          <hk-input
            formControlName="kilometrajeInspeccion"
            modoTeclado="numeric"
            [maxCaracteres]="7"
          />
        </hk-form-field>
        <div class="flex justify-end">
          <button
            hk-button
            tipo="submit"
            icono="check"
            class="max-sm:w-full"
            [cargando]="guardando()"
          >
            {{ 'taller.diagnostico.guardar' | transloco }}
          </button>
        </div>
      </form>
    } @else if (orden().diagnostico) {
      <dl class="space-y-4 text-sm">
        <div>
          <dt class="text-muted">{{ 'taller.campos.diagnostico' | transloco }}</dt>
          <dd class="mt-1 whitespace-pre-line text-fg">{{ orden().diagnostico }}</dd>
        </div>
        @if (orden().observacionesDiagnostico) {
          <div>
            <dt class="text-muted">{{ 'taller.campos.observaciones_diagnostico' | transloco }}</dt>
            <dd class="mt-1 whitespace-pre-line text-fg">{{ orden().observacionesDiagnostico }}</dd>
          </div>
        }
        @if (orden().kilometrajeInspeccion !== null) {
          <div>
            <dt class="text-muted">{{ 'taller.campos.kilometraje_inspeccion' | transloco }}</dt>
            <dd class="mt-1 text-fg tabular">{{ orden().kilometrajeInspeccion }} km</dd>
          </div>
        }
      </dl>
    } @else {
      <p class="text-sm text-muted">{{ 'taller.diagnostico.sin_registrar' | transloco }}</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkDiagnosticoForm {
  private readonly api = inject(OrdenesApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly orden = input.required<Orden>();
  readonly guardado = output<Orden>();
  protected readonly guardando = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    diagnostico: ['', [Validators.required, Validators.maxLength(4000)]],
    observaciones: ['', Validators.maxLength(2000)],
    kilometrajeInspeccion: [
      '',
      [
        Validators.pattern(/^\d+$/),
        Validators.max(MAX_KILOMETRAJE),
        (control: AbstractControl): ValidationErrors | null => this.noMenorQueIngreso(control),
      ],
    ],
  });

  constructor() {
    // Cada vez que llega otra versión de la orden, el formulario muestra lo guardado
    effect(() => {
      const o = this.orden();
      this.form.reset({
        diagnostico: o.diagnostico ?? '',
        observaciones: o.observacionesDiagnostico ?? '',
        kilometrajeInspeccion: o.kilometrajeInspeccion?.toString() ?? '',
      });
    });
  }

  private noMenorQueIngreso(control: AbstractControl): ValidationErrors | null {
    const valor: unknown = control.value;
    if (typeof valor !== 'string' || !/^\d+$/.test(valor)) return null;
    const minimo = this.orden().kilometrajeIngreso;
    return Number(valor) < minimo ? { kilometrajeMenor: { minimo } } : null;
  }

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
      .registrarDiagnostico(
        this.orden(),
        {
          diagnostico: v.diagnostico.trim(),
          observaciones: v.observaciones.trim() || null,
          kilometrajeInspeccion: v.kilometrajeInspeccion ? Number(v.kilometrajeInspeccion) : null,
        },
        conFormulario(this.form),
      )
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe((orden) => this.guardado.emit(orden));
  }
}
