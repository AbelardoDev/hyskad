import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkAvatar } from '../../shared/ui/avatar/avatar';
import { HkIconButton } from '../../shared/ui/button/icon-button';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkDropdownMenu, ItemMenu } from '../../shared/ui/dropdown-menu/dropdown-menu';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkTooltipDirective } from '../../shared/ui/tooltip/tooltip';
import { IDIOMAS, LanguageService } from '../i18n/language.service';
import { PreferenciaTema, ThemeService } from '../theme/theme.service';
import { BusquedaProximamente } from './busqueda-proximamente';
import { LayoutService } from './layout.service';
import { MigasService } from './migas.service';

const ICONO_TEMA: Record<PreferenciaTema, string> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
};
const TEMAS: readonly PreferenciaTema[] = ['system', 'light', 'dark'];

const POSICION_PANEL: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
];

/**
 * Barra superior: menú, migas, buscador, idioma, tema, notificaciones y usuario.
 * Efecto vidrio (`bg-surface/80 backdrop-blur-md`) y fija arriba.
 */
@Component({
  selector: 'hk-topbar',
  imports: [
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    HkIconButton,
    HkDropdownMenu,
    HkAvatar,
    HkEmptyState,
    HkTooltipDirective,
  ],
  template: `
    <div class="flex h-16 items-center gap-2 px-4 md:px-6 lg:px-8">
      <button
        hk-icon-button
        [icono]="
          layout.esMovil() ? 'menu' : layout.colapsado() ? 'panel-left-open' : 'panel-left-close'
        "
        [etiqueta]="etiquetaMenu() | transloco"
        [hkTooltip]="etiquetaMenu() | transloco"
        hkTooltipPosicion="abajo"
        [attr.aria-expanded]="layout.esMovil() ? null : !layout.colapsado()"
        class="-ml-2"
        (click)="alternarMenu.emit()"
      ></button>

      <!-- Migas (tablet/escritorio) o título de la página (móvil) -->
      <nav class="min-w-0 flex-1" [attr.aria-label]="'layout.migas' | transloco">
        <ol class="flex min-w-0 items-center gap-1.5 text-sm">
          @for (miga of migas.migas(); track miga.url; let ultima = $last) {
            <li class="flex min-w-0 items-center gap-1.5" [class.max-md:hidden]="!ultima">
              @if (ultima) {
                <span class="truncate font-semibold text-fg" aria-current="page">{{
                  miga.clave | transloco
                }}</span>
              } @else {
                <a
                  [routerLink]="miga.url"
                  class="truncate rounded-md text-muted hk-foco transition-colors hover:text-fg"
                >
                  {{ miga.clave | transloco }}
                </a>
                <svg
                  lucideIcon="chevron-right"
                  class="size-3.5 shrink-0 text-muted"
                  aria-hidden="true"
                />
              }
            </li>
          }
        </ol>
      </nav>

      <!-- Buscador global -->
      <button
        type="button"
        class="group hidden h-10 w-64 items-center gap-2 rounded-xl border border-border bg-surface-2/70 px-3 text-sm text-muted hk-foco transition-colors hover:border-border-strong hover:text-fg lg:inline-flex xl:w-80"
        aria-keyshortcuts="Control+K Meta+K"
        (click)="abrirBusqueda()"
      >
        <svg lucideIcon="search" class="size-4" aria-hidden="true" />
        <span class="flex-1 text-left">{{ 'layout.buscar' | transloco }}</span>
        <kbd
          class="rounded-md border border-border bg-surface px-1.5 font-sans text-[0.6875rem] font-medium"
          aria-hidden="true"
        >
          {{ atajo }}
        </kbd>
      </button>
      <button
        hk-icon-button
        icono="search"
        class="lg:hidden"
        [etiqueta]="'layout.buscar_etiqueta' | transloco"
        (click)="abrirBusqueda()"
      ></button>

      <!-- Idioma -->
      <hk-dropdown-menu
        class="max-sm:hidden"
        [etiqueta]="'layout.idioma' | transloco"
        [nombreEnContenido]="true"
        [items]="itemsIdioma()"
        [seleccionado]="idioma.idioma()"
        (seleccion)="cambiarIdioma($event)"
      >
        <span class="sr-only">{{ 'layout.idioma' | transloco }}</span>
        <svg lucideIcon="languages" class="size-5" aria-hidden="true" />
        <span class="text-xs font-semibold uppercase max-md:hidden">{{ idioma.idioma() }}</span>
      </hk-dropdown-menu>

      <!-- Tema -->
      <hk-dropdown-menu
        [etiqueta]="'layout.tema' | transloco"
        [items]="itemsTema()"
        [seleccionado]="tema.preferencia()"
        (seleccion)="cambiarTema($event)"
      >
        <svg [lucideIcon]="iconoTema()" class="size-5" aria-hidden="true" />
      </hk-dropdown-menu>

      <!-- Notificaciones -->
      <button
        hk-icon-button
        icono="bell"
        cdkOverlayOrigin
        #origenNotificaciones="cdkOverlayOrigin"
        [etiqueta]="'layout.notificaciones' | transloco"
        [attr.aria-expanded]="notificacionesAbiertas()"
        aria-haspopup="dialog"
        (click)="notificacionesAbiertas.set(!notificacionesAbiertas())"
      ></button>
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origenNotificaciones"
        [cdkConnectedOverlayOpen]="notificacionesAbiertas()"
        [cdkConnectedOverlayPositions]="posicionPanel"
        (overlayOutsideClick)="notificacionesAbiertas.set(false)"
        (overlayKeydown)="$event.key === 'Escape' && notificacionesAbiertas.set(false)"
        (detach)="notificacionesAbiertas.set(false)"
      >
        <section
          role="dialog"
          class="w-[min(22rem,calc(100vw-2rem))] hk-overlay"
          [attr.aria-label]="'layout.notificaciones' | transloco"
        >
          <header class="border-b border-border px-4 py-3">
            <h2 class="text-sm font-semibold text-fg">{{ 'layout.notificaciones' | transloco }}</h2>
          </header>
          <hk-empty-state
            compacto
            icono="bell"
            [titulo]="'layout.sin_notificaciones' | transloco"
            [texto]="'layout.sin_notificaciones_texto' | transloco"
          />
        </section>
      </ng-template>

      <!-- Usuario -->
      <hk-dropdown-menu
        [etiqueta]="'layout.menu_usuario' | transloco"
        [items]="itemsUsuario()"
        claseDisparador="ml-1 inline-flex rounded-full hk-foco max-md:size-11 max-md:items-center max-md:justify-center"
        (seleccion)="alElegirUsuario($event)"
      >
        <hk-avatar
          [nombre]="'layout.usuario_invitado' | transloco"
          tamano="sm"
          aria-hidden="true"
        />
        <div hkMenuEncabezado class="mb-1.5 border-b border-border px-2.5 pt-1 pb-2.5">
          <p class="text-sm font-semibold text-fg">{{ 'layout.usuario_invitado' | transloco }}</p>
          <p class="text-xs text-muted">{{ 'layout.sin_sesion' | transloco }}</p>
        </div>
      </hk-dropdown-menu>
    </div>
  `,
  host: {
    class: 'sticky top-0 z-30 block border-b border-border bg-surface/80 backdrop-blur-md',
    '(document:keydown)': 'alTeclear($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkTopbar {
  protected readonly layout = inject(LayoutService);
  protected readonly migas = inject(MigasService);
  protected readonly tema = inject(ThemeService);
  protected readonly idioma = inject(LanguageService);
  private readonly dialogos = inject(DialogosService);
  private readonly router = inject(Router);

  readonly alternarMenu = output<void>();

  protected readonly posicionPanel = POSICION_PANEL;
  protected readonly notificacionesAbiertas = signal(false);
  protected readonly atajo = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '')
    ? '⌘ K'
    : 'Ctrl K';
  private busquedaAbierta = false;

  protected readonly etiquetaMenu = computed(() => {
    if (this.layout.esMovil()) return 'layout.abrir_menu';
    return this.layout.colapsado() ? 'layout.expandir_menu' : 'layout.colapsar_menu';
  });
  protected readonly iconoTema = computed(() => ICONO_TEMA[this.tema.preferencia()]);

  private readonly textosIdioma = translateSignal(IDIOMAS.map((i) => `idiomas.${i}`));
  private readonly textosTema = translateSignal(TEMAS.map((t) => `layout.tema_${t}`));
  private readonly textosUsuario = translateSignal([
    'layout.perfil',
    'layout.cambiar_password',
    'layout.cerrar_sesion',
  ]);

  protected readonly itemsIdioma = computed<ItemMenu[]>(() =>
    IDIOMAS.map((id, i) => ({ id, etiqueta: this.textosIdioma()[i] })),
  );
  protected readonly itemsTema = computed<ItemMenu[]>(() =>
    TEMAS.map((id, i) => ({ id, etiqueta: this.textosTema()[i], icono: ICONO_TEMA[id] })),
  );
  protected readonly itemsUsuario = computed<ItemMenu[]>(() => {
    const [perfil, password, salir] = this.textosUsuario();
    return [
      { id: 'perfil', etiqueta: perfil, icono: 'user' },
      { id: 'password', etiqueta: password, icono: 'key-round' },
      // Cerrar sesión se habilita con la autenticación del frontend (F04B).
      {
        id: 'salir',
        etiqueta: salir,
        icono: 'log-out',
        peligro: true,
        separadorAntes: true,
        deshabilitado: true,
      },
    ];
  });

  protected cambiarIdioma(id: string): void {
    const idioma = IDIOMAS.find((i) => i === id);
    if (idioma) this.idioma.cambiar(idioma);
  }

  protected cambiarTema(id: string): void {
    const tema = TEMAS.find((t) => t === id);
    if (tema) this.tema.cambiar(tema);
  }

  protected alElegirUsuario(id: string): void {
    if (id === 'perfil' || id === 'password') void this.router.navigateByUrl('/perfil');
  }

  protected abrirBusqueda(): void {
    if (this.busquedaAbierta) return;
    this.busquedaAbierta = true;
    this.dialogos
      .abrirModal(BusquedaProximamente, { tamano: 'lg' })
      .closed.subscribe(() => (this.busquedaAbierta = false));
  }

  protected alTeclear(evento: KeyboardEvent): void {
    if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
      evento.preventDefault();
      this.abrirBusqueda();
    }
  }
}
