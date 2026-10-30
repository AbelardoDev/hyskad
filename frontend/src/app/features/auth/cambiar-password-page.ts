import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { AuthService } from '../../core/auth/auth.service';
import { HkButton } from '../../shared/ui/button/button';
import { ToastService } from '../../shared/ui/toast/toast';
import { HkCambioPasswordForm } from '../perfil/cambio-password-form';

/** Cambio obligatorio de contraseña en el primer ingreso (RN-46): no deja ir a otra pantalla. */
@Component({
  selector: 'hk-cambiar-password-page',
  imports: [TranslocoPipe, LucideDynamicIcon, HkButton, HkCambioPasswordForm],
  template: `
    <section class="hk-panel p-6 sm:p-8">
      <span
        class="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-ink"
      >
        <svg lucideIcon="lock-keyhole" class="size-6" aria-hidden="true" />
      </span>
      <h1 class="font-display text-2xl font-bold tracking-tight text-fg">
        {{ 'auth.cambiar.titulo' | transloco }}
      </h1>
      <p class="mt-1.5 text-sm text-muted">
        {{ 'auth.cambiar.subtitulo' | transloco: { nombre: auth.usuario()?.nombre } }}
      </p>
      <hk-cambio-password-form class="mt-7" [anchoCompleto]="true" (cambiada)="alCambiar()" />
      <button hk-button variante="ghost" icono="log-out" class="mt-4" (click)="auth.logout()">
        {{ 'layout.cerrar_sesion' | transloco }}
      </button>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambiarPasswordPage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected alCambiar(): void {
    this.toast.exito(this.transloco.translate('ui.password.cambiada'));
    void this.router.navigateByUrl('/');
  }
}
