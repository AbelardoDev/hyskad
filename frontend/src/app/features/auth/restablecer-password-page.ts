import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize } from 'rxjs';

import { AuthApiService } from '../../core/auth/auth-api.service';
import { erroresManejados, marcarErroresServidor, problemaDe } from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import { HkButton } from '../../shared/ui/button/button';
import {
  grupoPasswordNueva,
  HkCamposPasswordNueva,
} from '../../shared/ui/forms/campos-password-nueva';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { ToastService } from '../../shared/ui/toast/toast';
import { HkAvisoFormulario } from '../../shared/ui/forms/aviso-formulario';

/** Restablecer la contraseña con el enlace del correo (RF35, RN-50). Lee `token` de la URL. */
@Component({
  selector: 'hk-restablecer-password-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    HkButton,
    HkCamposPasswordNueva,
    HkAvisoFormulario,
  ],
  template: `
    <section class="hk-panel p-6 sm:p-8">
      @if (!token() || enlaceInvalido()) {
        <span
          class="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger-ink"
        >
          <svg lucideIcon="circle-alert" class="size-6" aria-hidden="true" />
        </span>
        <h1 class="font-display text-2xl font-bold tracking-tight text-fg">
          {{ 'auth.restablecer.invalido_titulo' | transloco }}
        </h1>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          {{ 'auth.restablecer.invalido_texto' | transloco }}
        </p>
        <a hk-button class="mt-6" anchoCompleto routerLink="/olvide-password">
          {{ 'auth.restablecer.pedir_otro' | transloco }}
        </a>
      } @else {
        <h1 class="font-display text-2xl font-bold tracking-tight text-fg">
          {{ 'auth.restablecer.titulo' | transloco }}
        </h1>
        <p class="mt-1.5 text-sm text-muted">{{ 'auth.restablecer.subtitulo' | transloco }}</p>

        <form class="mt-7 space-y-5" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
          @if (error(); as clave) {
            <hk-aviso-formulario>{{ clave | transloco }}</hk-aviso-formulario>
          }
          <hk-campos-password-nueva [grupo]="form" />
          <button hk-button tipo="submit" tamano="lg" anchoCompleto [cargando]="enviando()">
            {{ 'auth.restablecer.guardar' | transloco }}
          </button>
        </form>
      }

      <a
        routerLink="/login"
        class="mt-6 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-primary hk-foco hover:underline"
      >
        <svg lucideIcon="chevron-left" class="size-4" aria-hidden="true" />
        {{ 'auth.volver_login' | transloco }}
      </a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestablecerPasswordPage {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Query param `token` del enlace del correo. */
  readonly token = input<string>();

  protected readonly form = grupoPasswordNueva(inject(NonNullableFormBuilder));
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly enlaceInvalido = signal(false);

  protected enviar(): void {
    const token = this.token();
    if (this.enviando() || !token) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    this.api
      .restablecerPassword(token, this.form.getRawValue().nueva, erroresManejados())
      .pipe(finalize(() => this.enviando.set(false)))
      .subscribe({
        next: () => {
          this.toast.exito(this.transloco.translate('auth.restablecer.exito'));
          void this.router.navigateByUrl('/login');
        },
        error: (e: HttpErrorResponse) => this.mostrarError(e),
      });
  }

  private mostrarError(e: HttpErrorResponse): void {
    const codigo = codigoDeError(e);
    if (codigo === 'TOKEN_INVALIDO') {
      this.enlaceInvalido.set(true);
      return;
    }
    const errores = problemaDe(e.error)?.errors ?? [];
    if (errores.length > 0) marcarErroresServidor(this.form, errores);
    this.error.set(e.status === 429 ? 'auth.demasiados_intentos' : `errors.${codigo}`);
  }
}
