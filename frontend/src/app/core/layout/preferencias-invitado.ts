import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkDropdownMenu, ItemMenu } from '../../shared/ui/dropdown-menu/dropdown-menu';
import { IDIOMAS, LanguageService } from '../i18n/language.service';
import { PreferenciaTema, ThemeService } from '../theme/theme.service';

const ICONO_TEMA: Record<PreferenciaTema, string> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
};
const TEMAS: readonly PreferenciaTema[] = ['system', 'light', 'dark'];

/** Selectores de idioma y tema de las pantallas de acceso (sin sesión). */
@Component({
  selector: 'hk-preferencias-invitado',
  imports: [TranslocoPipe, LucideDynamicIcon, HkDropdownMenu],
  template: `
    <hk-dropdown-menu
      [etiqueta]="'layout.idioma' | transloco"
      [nombreEnContenido]="true"
      [items]="itemsIdioma()"
      [seleccionado]="idioma.idioma()"
      (seleccion)="cambiarIdioma($event)"
    >
      <span class="sr-only">{{ 'layout.idioma' | transloco }}</span>
      <svg lucideIcon="languages" class="size-5" aria-hidden="true" />
      <span class="text-xs font-semibold uppercase">{{ idioma.idioma() }}</span>
    </hk-dropdown-menu>
    <hk-dropdown-menu
      [etiqueta]="'layout.tema' | transloco"
      [items]="itemsTema()"
      [seleccionado]="tema.preferencia()"
      (seleccion)="cambiarTema($event)"
    >
      <svg [lucideIcon]="iconoTema()" class="size-5" aria-hidden="true" />
    </hk-dropdown-menu>
  `,
  host: { class: 'flex items-center gap-1' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkPreferenciasInvitado {
  protected readonly idioma = inject(LanguageService);
  protected readonly tema = inject(ThemeService);

  private readonly textosIdioma = translateSignal(IDIOMAS.map((i) => `idiomas.${i}`));
  private readonly textosTema = translateSignal(TEMAS.map((t) => `layout.tema_${t}`));

  protected readonly iconoTema = computed(() => ICONO_TEMA[this.tema.preferencia()]);
  protected readonly itemsIdioma = computed<ItemMenu[]>(() =>
    IDIOMAS.map((id, i) => ({ id, etiqueta: this.textosIdioma()[i] })),
  );
  protected readonly itemsTema = computed<ItemMenu[]>(() =>
    TEMAS.map((id, i) => ({ id, etiqueta: this.textosTema()[i], icono: ICONO_TEMA[id] })),
  );

  protected cambiarIdioma(id: string): void {
    const idioma = IDIOMAS.find((i) => i === id);
    if (idioma) this.idioma.cambiar(idioma);
  }

  protected cambiarTema(id: string): void {
    const tema = TEMAS.find((t) => t === id);
    if (tema) this.tema.cambiar(tema);
  }
}
