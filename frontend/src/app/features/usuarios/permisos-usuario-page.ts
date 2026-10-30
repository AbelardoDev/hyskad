import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { finalize, forkJoin } from 'rxjs';

import { MODULOS_PERMISOS, Permiso } from '../../core/auth/permisos';
import { erroresManejados } from '../../core/http/contexto-http';
import { HkAvatar } from '../../shared/ui/avatar/avatar';
import { HkBadge } from '../../shared/ui/badge/badge';
import { HkRolBadge } from '../../shared/ui/badge/rol-badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkAvisoFormulario } from '../../shared/ui/forms/aviso-formulario';
import { HkSwitch } from '../../shared/ui/forms/switch';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ToastService } from '../../shared/ui/toast/toast';
import { AjustePermiso, PermisoDeUsuario, UsuariosApiService } from './usuarios-api.service';

/** Ajustes a enviar: los permisos cuyo estado difiere del que trae el rol (ARCHITECTURE §5). */
export function ajustesDesde(
  permisos: readonly PermisoDeUsuario[],
  efectivos: ReadonlyMap<Permiso, boolean>,
): AjustePermiso[] {
  return permisos
    .filter((p) => (efectivos.get(p.permiso) ?? p.efectivo) !== p.delRol)
    .map((p) => ({ permiso: p.permiso, concedido: efectivos.get(p.permiso) ?? p.efectivo }));
}

/**
 * Permisos de un usuario (RF4) agrupados por módulo. Cada switch muestra si el permiso viene del
 * rol; los no editables (solo admin, o los propios) quedan deshabilitados.
 */
@Component({
  selector: 'hk-permisos-usuario-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    HkAvatar,
    HkBadge,
    HkRolBadge,
    HkButton,
    HkCard,
    HkEmptyState,
    HkAvisoFormulario,
    HkSwitch,
    HkPageHeader,
    HkSkeleton,
  ],
  template: `
    <hk-page-header
      [titulo]="'usuarios.permisos.titulo' | transloco"
      [subtitulo]="'usuarios.permisos.subtitulo' | transloco"
    >
      <a hk-button variante="secondary" icono="chevron-left" routerLink="/usuarios">
        {{ 'usuarios.permisos.volver' | transloco }}
      </a>
    </hk-page-header>

    @if (datos.error()) {
      <hk-card>
        <hk-empty-state
          icono="circle-alert"
          [titulo]="'usuarios.permisos.error_titulo' | transloco"
          [texto]="'usuarios.error_texto' | transloco"
        >
          <button hk-button variante="secondary" icono="rotate-ccw" (click)="datos.reload()">
            {{ 'comun.reintentar' | transloco }}
          </button>
        </hk-empty-state>
      </hk-card>
    } @else if (datos.value(); as d) {
      <div class="flex flex-col gap-6">
        <hk-card>
          <div class="flex flex-wrap items-center gap-4">
            <hk-avatar [nombre]="d.usuario.nombre" tamano="lg" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-base font-semibold text-fg">{{ d.usuario.nombre }}</p>
              <p class="truncate text-sm text-muted">{{ d.usuario.email }}</p>
            </div>
            <hk-rol-badge [rol]="d.usuario.rol" />
          </div>
          <p class="mt-4 border-t border-border pt-4 text-sm text-muted">
            {{ 'usuarios.permisos.ayuda' | transloco }}
          </p>
          @if (!algunoEditable()) {
            <hk-aviso-formulario class="mt-4">
              {{ 'usuarios.permisos.propios' | transloco }}
            </hk-aviso-formulario>
          }
        </hk-card>

        <div class="grid gap-6 xl:grid-cols-2">
          @for (modulo of modulos(); track modulo.clave) {
            <hk-card [titulo]="'usuarios.permisos.modulos.' + modulo.clave | transloco">
              <ul class="-my-1 divide-y divide-border">
                @for (p of modulo.permisos; track p.permiso) {
                  <li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                    <hk-switch
                      [valor]="efectivos().get(p.permiso) ?? p.efectivo"
                      [deshabilitado]="!p.editable || guardando()"
                      (valorChange)="cambiar(p.permiso, $event)"
                    >
                      {{ 'permisos.' + p.permiso | transloco }}
                    </hk-switch>
                    <span class="flex flex-wrap gap-1.5">
                      @if (p.soloAdmin) {
                        <hk-badge tono="warning" icono="key-round">
                          {{ 'usuarios.permisos.solo_admin' | transloco }}
                        </hk-badge>
                      }
                      @if (p.delRol) {
                        <hk-badge>{{ 'usuarios.permisos.del_rol' | transloco }}</hk-badge>
                      }
                      @if ((efectivos().get(p.permiso) ?? p.efectivo) !== p.delRol) {
                        <hk-badge tono="info" icono="pencil">
                          {{
                            ((efectivos().get(p.permiso) ?? p.efectivo)
                              ? 'usuarios.permisos.concedido'
                              : 'usuarios.permisos.retirado'
                            ) | transloco
                          }}
                        </hk-badge>
                      }
                    </span>
                  </li>
                }
              </ul>
            </hk-card>
          }
        </div>
      </div>

      @if (algunoEditable()) {
        <div
          class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-6 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-surface/90 p-3 shadow-overlay backdrop-blur-md md:bottom-4"
        >
          @if (hayCambios()) {
            <p class="mr-auto px-1 text-sm text-muted" role="status">
              {{ 'usuarios.permisos.sin_guardar' | transloco }}
            </p>
          }
          <button
            hk-button
            variante="secondary"
            icono="rotate-ccw"
            [deshabilitado]="guardando()"
            (click)="restablecerRol()"
          >
            {{ 'usuarios.permisos.restablecer' | transloco }}
          </button>
          <button
            hk-button
            icono="check"
            [cargando]="guardando()"
            [deshabilitado]="!hayCambios()"
            (click)="guardar()"
          >
            {{ 'usuarios.permisos.guardar' | transloco }}
          </button>
        </div>
      }
    } @else {
      <div class="flex flex-col gap-6" aria-busy="true">
        <hk-card><hk-skeleton [lineas]="2" /></hk-card>
        <div class="grid gap-6 xl:grid-cols-2">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <hk-card><hk-skeleton [lineas]="4" /></hk-card>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermisosUsuarioPage {
  private readonly api = inject(UsuariosApiService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  /** Parámetro `:id` de la ruta. */
  readonly id = input.required<string>();

  protected readonly datos = rxResource({
    params: () => Number(this.id()),
    stream: ({ params: id }) =>
      forkJoin({
        usuario: this.api.obtener(id, erroresManejados()),
        permisos: this.api.permisos(id, erroresManejados()),
      }),
  });
  protected readonly guardando = signal(false);

  private readonly permisos = computed(() => this.datos.value()?.permisos ?? []);
  /** Estado elegido en pantalla de cada permiso (parte del guardado en el servidor). */
  protected readonly efectivos = linkedSignal<Map<Permiso, boolean>>(
    () => new Map(this.permisos().map((p) => [p.permiso, p.efectivo])),
  );

  protected readonly modulos = computed(() => {
    const porPermiso = new Map(this.permisos().map((p) => [p.permiso, p]));
    return MODULOS_PERMISOS.map((m) => ({
      clave: m.clave,
      permisos: m.permisos.flatMap((permiso) => porPermiso.get(permiso) ?? []),
    })).filter((m) => m.permisos.length > 0);
  });
  protected readonly algunoEditable = computed(() => this.permisos().some((p) => p.editable));
  protected readonly hayCambios = computed(() =>
    this.permisos().some((p) => this.efectivos().get(p.permiso) !== p.efectivo),
  );

  protected cambiar(permiso: Permiso, valor: boolean): void {
    this.efectivos.update((actual) => new Map(actual).set(permiso, valor));
  }

  /** Deja solo los permisos del rol (los no editables no cambian). */
  protected restablecerRol(): void {
    this.efectivos.set(
      new Map(this.permisos().map((p) => [p.permiso, p.editable ? p.delRol : p.efectivo])),
    );
  }

  protected guardar(): void {
    const actual = this.datos.value();
    if (!actual || this.guardando()) return;
    this.guardando.set(true);
    this.api
      .actualizarPermisos(actual.usuario.id, ajustesDesde(actual.permisos, this.efectivos()))
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe((permisos) => {
        this.datos.set({ ...actual, permisos });
        this.toast.exito(
          this.transloco.translate('usuarios.permisos.guardados', {
            nombre: actual.usuario.nombre,
          }),
        );
      });
  }
}
