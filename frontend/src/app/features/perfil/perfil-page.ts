import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../../core/auth/auth.service';
import { IDIOMAS } from '../../core/i18n/language.service';
import { HkAvatar } from '../../shared/ui/avatar/avatar';
import { HkRolBadge } from '../../shared/ui/badge/rol-badge';
import { HkCard } from '../../shared/ui/card/card';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { ToastService } from '../../shared/ui/toast/toast';
import { HkCambioPasswordForm } from './cambio-password-form';

/** Mi perfil: datos propios, idioma preferido (se guarda en el backend) y cambio de contraseña. */
@Component({
  selector: 'hk-perfil-page',
  imports: [
    TranslocoPipe,
    HkAvatar,
    HkRolBadge,
    HkCard,
    HkFormField,
    HkSelect,
    HkPageHeader,
    HkCambioPasswordForm,
  ],
  template: `
    <hk-page-header
      [titulo]="'perfil.titulo' | transloco"
      [subtitulo]="'perfil.subtitulo' | transloco"
    />
    @if (auth.usuario(); as u) {
      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div class="flex flex-col gap-6">
          <hk-card [titulo]="'perfil.datos' | transloco">
            <div class="flex items-center gap-4">
              <hk-avatar [nombre]="u.nombre" tamano="lg" />
              <div class="min-w-0">
                <p class="truncate text-base font-semibold text-fg">{{ u.nombre }}</p>
                <p class="truncate text-sm text-muted">{{ u.email }}</p>
                <hk-rol-badge class="mt-2 inline-block" [rol]="u.rol" />
              </div>
            </div>
            <p class="mt-5 border-t border-border pt-4 text-xs text-muted">
              {{ 'perfil.datos_ayuda' | transloco }}
            </p>
          </hk-card>

          <hk-card [titulo]="'perfil.preferencias' | transloco">
            <hk-form-field
              [etiqueta]="'perfil.idioma' | transloco"
              [ayuda]="'perfil.idioma_ayuda' | transloco"
            >
              <hk-select
                [opciones]="opcionesIdioma()"
                [valor]="u.idioma"
                (valorChange)="cambiarIdioma($event)"
              />
            </hk-form-field>
          </hk-card>
        </div>

        <hk-card
          id="password"
          class="scroll-mt-24"
          [titulo]="'layout.cambiar_password' | transloco"
          [subtitulo]="'perfil.password_ayuda' | transloco"
        >
          <hk-cambio-password-form class="max-w-md" (cambiada)="alCambiarPassword()" />
        </hk-card>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilPage {
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  private readonly textosIdioma = translateSignal(IDIOMAS.map((i) => `idiomas.${i}`));
  protected readonly opcionesIdioma = computed<OpcionSelect[]>(() =>
    IDIOMAS.map((valor, i) => ({ valor, etiqueta: this.textosIdioma()[i] })),
  );

  protected cambiarIdioma(valor: string | null): void {
    const idioma = IDIOMAS.find((i) => i === valor);
    if (idioma) this.auth.cambiarIdioma(idioma);
  }

  protected alCambiarPassword(): void {
    this.toast.exito(this.transloco.translate('ui.password.cambiada'));
  }
}
