import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Tarjeta: superficie con borde, radio de 2xl y sombra suave (sin sombra en oscuro).
 * Acciones del encabezado con `<div hkCardAcciones>`, pie con `<div hkCardPie>`.
 */
@Component({
  selector: 'hk-card',
  template: `
    @if (titulo()) {
      <header class="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
        <div class="min-w-0">
          <h2 class="text-base font-semibold text-fg">{{ titulo() }}</h2>
          @if (subtitulo()) {
            <p class="mt-0.5 text-xs text-muted">{{ subtitulo() }}</p>
          }
        </div>
        <ng-content select="[hkCardAcciones]" />
      </header>
    }
    <div [class]="sinRelleno() ? '' : 'p-4 md:p-5'">
      <ng-content />
    </div>
    <ng-content select="[hkCardPie]" />
  `,
  host: { class: 'block overflow-hidden hk-panel' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkCard {
  readonly titulo = input<string>();
  readonly subtitulo = input<string>();
  /** Para tablas o listas que llegan hasta el borde. */
  readonly sinRelleno = input(false, { transform: booleanAttribute });
}
