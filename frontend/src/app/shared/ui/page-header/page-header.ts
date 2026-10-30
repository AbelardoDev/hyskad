import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Encabezado de página: título (display), subtítulo y acciones a la derecha.
 * La acción principal marcada con `hkAccionPrincipal` flota abajo a la derecha en móvil.
 */
@Component({
  selector: 'hk-page-header',
  template: `
    <div class="min-w-0">
      <h1 class="font-display text-2xl font-bold tracking-tight text-balance text-fg">
        {{ titulo() }}
      </h1>
      @if (subtitulo()) {
        <p class="mt-1 text-sm text-muted">{{ subtitulo() }}</p>
      }
    </div>
    <div class="flex flex-wrap items-center gap-2 empty:hidden">
      <ng-content />
      <div
        class="empty:hidden max-md:fixed max-md:right-4 max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))] max-md:z-30 max-md:[&_button]:shadow-overlay"
      >
        <ng-content select="[hkAccionPrincipal]" />
      </div>
    </div>
  `,
  host: { class: 'mb-6 flex flex-wrap items-end justify-between gap-4 animate-entrada' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkPageHeader {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>();
}
