import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { ThemeService } from '../../../core/theme/theme.service';

/**
 * Logo de HYSKAD (archivos de `public/brand`, ver docs/brand/README.md).
 * `fondo="auto"` sigue al tema; sobre superficies siempre oscuras (sidebar, login) usar `fondo="oscuro"`.
 */
@Component({
  selector: 'hk-logo',
  imports: [TranslocoPipe],
  template: `<img
    [src]="ruta()"
    [alt]="'app.nombre' | transloco"
    class="block h-full w-auto"
    draggable="false"
  />`,
  host: { class: 'inline-block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkLogo {
  private readonly tema = inject(ThemeService);

  readonly variante = input<'completo' | 'simbolo'>('completo');
  readonly fondo = input<'auto' | 'claro' | 'oscuro'>('auto');

  protected readonly ruta = computed(() => {
    const oscuro = this.fondo() === 'oscuro' || (this.fondo() === 'auto' && this.tema.oscuro());
    const base = this.variante() === 'completo' ? 'logo' : 'logo-mark';
    return `brand/${base}${oscuro ? '-on-dark' : ''}.svg`;
  });
}
