import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize } from 'rxjs';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { erroresManejados } from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import { HkButton } from '../../shared/ui/button/button';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkAvisoFormulario } from '../../shared/ui/forms/aviso-formulario';
import { cuentaRegresiva, segundosDeEspera } from './espera';

/** Solicitar el enlace de recuperación (RF35). La respuesta es la misma exista o no el correo (RN-50). */
@Component({
  selector: 'hk-olvide-password-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    HkButton,
    HkFormField,
    HkInput,
    HkAvisoFormulario,
  ],
  template: `
    <section class="hk-panel p-6 sm:p-8">
      @if (enviadoA(); as email) {
        <span
          class="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-success-soft text-success-ink"
        >
          <svg lucideIcon="mail-check" class="size-6" aria-hidden="true" />
        </span>
        <h1 class="font-display text-2xl font-bold tracking-tight text-fg">
          {{ 'auth.olvide.enviado_titulo' | transloco }}
        </h1>
        <p class="mt-2 text-sm leading-relaxed text-muted" role="status">
          {{ 'auth.olvide.enviado_texto' | transloco: { email } }}
        </p>
      } @else {
        <h1 class="font-display text-2xl font-bold tracking-tight text-fg">
          {{ 'auth.olvide.titulo' | transloco }}
        </h1>
        <p class="mt-1.5 text-sm text-muted">{{ 'auth.olvide.subtitulo' | transloco }}</p>

        <form class="mt-7 space-y-5" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
          @if (error(); as clave) {
            <hk-aviso-formulario>
              {{ clave | transloco }}
              @if (espera.segundos() > 0) {
                <span class="mt-0.5 block font-semibold">
                  {{ 'auth.espera' | transloco: { segundos: espera.segundos() } }}
                </span>
              }
            </hk-aviso-formulario>
          }
          <hk-form-field [etiqueta]="'auth.campos.email' | transloco">
            <hk-input
              formControlName="email"
              tipo="email"
              icono="mail"
              autocompletar="email"
              modoTeclado="email"
              [maxCaracteres]="254"
            />
          </hk-form-field>
          <button
            hk-button
            tipo="submit"
            tamano="lg"
            anchoCompleto
            [cargando]="enviando()"
            [deshabilitado]="espera.segundos() > 0"
          >
            {{ 'auth.olvide.enviar' | transloco }}
          </button>
        </form>
      }

      <a
        routerLink="/login"
        class="mt-6 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-primary hk-foco hover:underline"
      >
        <svg lucideIcon="arrow-left" class="size-4" aria-hidden="true" />
        {{ 'auth.volver_login' | transloco }}
      </a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OlvidePasswordPage {
  private readonly api = inject(AuthApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly espera = cuentaRegresiva();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly enviadoA = signal<string | null>(null);

  protected enviar(): void {
    if (this.enviando() || this.espera.segundos() > 0) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const email = this.form.getRawValue().email.trim();
    this.enviando.set(true);
    this.error.set(null);
    this.api
      .solicitarRecuperacion(email, erroresManejados())
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: () => this.enviadoA.set(email),
        error: (e: HttpErrorResponse) => {
          if (e.status === 429) {
            this.error.set('auth.demasiados_intentos');
            this.espera.iniciar(segundosDeEspera(e), () => this.error.set(null));
          } else {
            this.error.set(`errors.${codigoDeError(e)}`);
          }
        },
      });
  }
}
