import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize } from 'rxjs';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { erroresManejados, marcarErroresServidor, problemaDe } from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import { HkButton } from '../../shared/ui/button/button';
import {
  grupoPasswordNueva,
  HkCamposPasswordNueva,
} from '../../shared/ui/forms/campos-password-nueva';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkAvisoFormulario } from '../../shared/ui/forms/aviso-formulario';

/** Cambiar la contraseña propia (contraseña actual + nueva). Lo usan Mi perfil y el cambio obligatorio. */
@Component({
  selector: 'hk-cambio-password-form',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkButton,
    HkFormField,
    HkInput,
    HkCamposPasswordNueva,
    HkAvisoFormulario,
  ],
  template: `
    <form class="space-y-5" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
      @if (error(); as clave) {
        <hk-aviso-formulario>{{ clave | transloco }}</hk-aviso-formulario>
      }
      <hk-form-field [etiqueta]="'ui.password.actual' | transloco">
        <hk-input
          formControlName="actual"
          tipo="password"
          autocompletar="current-password"
          [maxCaracteres]="72"
        />
      </hk-form-field>
      <hk-campos-password-nueva [grupo]="form.controls.clave" />
      <button
        hk-button
        tipo="submit"
        icono="key-round"
        [anchoCompleto]="anchoCompleto()"
        [tamano]="anchoCompleto() ? 'lg' : 'md'"
        [cargando]="enviando()"
      >
        {{ 'ui.password.guardar' | transloco }}
      </button>
    </form>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkCambioPasswordForm {
  private readonly api = inject(AuthApiService);
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly anchoCompleto = input(false);
  readonly cambiada = output<void>();

  protected readonly form = this.fb.group({
    actual: ['', Validators.required],
    clave: grupoPasswordNueva(this.fb),
  });
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected enviar(): void {
    if (this.enviando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const { actual, clave } = this.form.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.api
      .cambiarPassword(actual, clave.nueva, erroresManejados())
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: () => {
          const usuario = this.auth.usuario();
          if (usuario) this.auth.actualizarUsuario({ ...usuario, debeCambiarPassword: false });
          this.form.reset();
          this.cambiada.emit();
        },
        error: (e: HttpErrorResponse) => this.mostrarError(e),
      });
  }

  private mostrarError(e: HttpErrorResponse): void {
    const codigo = codigoDeError(e);
    if (codigo === 'PASSWORD_ACTUAL_INCORRECTA') {
      marcarErroresServidor(this.form, [{ campo: 'actual', code: codigo }]);
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const errores = problemaDe(e.error)?.errors ?? [];
    if (errores.length > 0) marcarErroresServidor(this.form, errores);
    this.error.set(e.status === 429 ? 'auth.demasiados_intentos' : `errors.${codigo}`);
  }
}
