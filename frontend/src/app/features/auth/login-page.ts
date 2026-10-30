import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize } from 'rxjs';

import { AuthService, esRutaInterna } from '../../core/auth/auth.service';
import { RUTA_CAMBIAR_PASSWORD } from '../../core/auth/guards';
import { erroresManejados } from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import { HkButton } from '../../shared/ui/button/button';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkAvisoFormulario } from '../../shared/ui/forms/aviso-formulario';
import { cuentaRegresiva, segundosDeEspera } from './espera';

/** Inicio de sesión (RF2). Errores genéricos (RN-49) y cuenta regresiva ante el 429 (IC6). */
@Component({
  selector: 'hk-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    HkButton,
    HkFormField,
    HkInput,
    HkAvisoFormulario,
  ],
  template: `
    <section class="hk-panel p-6 sm:p-8">
      <h1 class="font-display text-2xl font-bold tracking-tight text-fg">
        {{ 'auth.login.titulo' | transloco }}
      </h1>
      <p class="mt-1.5 text-sm text-muted">{{ 'auth.login.subtitulo' | transloco }}</p>

      <form class="mt-7 space-y-5" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
        @if (error(); as clave) {
          <hk-aviso-formulario>
            {{ clave | transloco }}
            @if (esperaS() > 0) {
              <span class="mt-0.5 block font-semibold">
                {{ 'auth.espera' | transloco: { segundos: esperaS() } }}
              </span>
            }
          </hk-aviso-formulario>
        }

        <hk-form-field [etiqueta]="'auth.campos.email' | transloco">
          <hk-input
            formControlName="email"
            tipo="email"
            icono="mail"
            autocompletar="username"
            modoTeclado="email"
            [maxCaracteres]="254"
          />
        </hk-form-field>

        <div>
          <hk-form-field [etiqueta]="'auth.campos.password' | transloco">
            <hk-input formControlName="password" tipo="password" autocompletar="current-password" />
          </hk-form-field>
          <div class="mt-2 text-right">
            <a
              routerLink="/olvide-password"
              class="rounded-md text-sm font-medium text-primary hk-foco hover:underline"
            >
              {{ 'auth.login.olvide' | transloco }}
            </a>
          </div>
        </div>

        <button
          hk-button
          tipo="submit"
          tamano="lg"
          anchoCompleto
          [cargando]="enviando()"
          [deshabilitado]="bloqueado()"
        >
          {{ 'auth.login.entrar' | transloco }}
        </button>
      </form>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly espera = cuentaRegresiva();

  /** Query param `returnUrl` (lo pone el guard al pedir login). */
  readonly returnUrl = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly enviando = signal(false);
  /** Clave i18n del error a mostrar. */
  protected readonly error = signal<string | null>(null);
  protected readonly esperaS = this.espera.segundos;
  protected readonly bloqueado = computed(() => this.esperaS() > 0);

  protected enviar(): void {
    if (this.enviando() || this.bloqueado()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    this.auth
      .login(email.trim(), password, erroresManejados())
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: (usuario) => {
          const retorno = this.returnUrl();
          const destino = usuario.debeCambiarPassword
            ? RUTA_CAMBIAR_PASSWORD
            : esRutaInterna(retorno)
              ? retorno
              : '/';
          void this.router.navigateByUrl(destino);
        },
        error: (e: HttpErrorResponse) => this.mostrarError(e),
      });
  }

  private mostrarError(e: HttpErrorResponse): void {
    this.form.controls.password.reset();
    if (e.status === 429) {
      this.error.set('auth.demasiados_intentos');
      this.espera.iniciar(segundosDeEspera(e), () => this.error.set(null));
    } else {
      this.error.set(`errors.${codigoDeError(e)}`);
    }
  }
}
