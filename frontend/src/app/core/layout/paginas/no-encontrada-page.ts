import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { HkButton } from '../../../shared/ui/button/button';
import { HkLogo } from '../../../shared/ui/logo/logo';

/** 404 con estilo de marca: panel navy con malla de puntos, logo y regreso al inicio. */
@Component({
  selector: 'hk-no-encontrada-page',
  imports: [RouterLink, TranslocoPipe, LucideDynamicIcon, HkButton, HkLogo],
  template: `
    <main
      class="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-linear-to-br from-brand-950 via-brand-900 to-brand-800 px-4 py-12 text-center"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(140_188_255/0.18)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black_35%,transparent_75%)] bg-size-[22px_22px]"
        aria-hidden="true"
      ></div>
      <div
        class="pointer-events-none absolute -top-40 -right-40 size-96 rounded-full bg-accent/20 blur-3xl"
        aria-hidden="true"
      ></div>

      <div class="relative flex max-w-lg animate-entrada flex-col items-center">
        <hk-logo variante="completo" fondo="oscuro" class="mb-12 h-9" />
        <span
          class="mb-6 inline-flex size-20 items-center justify-center rounded-3xl bg-white/8 text-accent ring-1 ring-white/15"
        >
          <svg lucideIcon="compass" class="size-10" [strokeWidth]="1.5" aria-hidden="true" />
        </span>
        <p class="font-display text-sm font-semibold tracking-widest text-brand-300 uppercase">
          {{ 'no_encontrada.codigo' | transloco }}
        </p>
        <h1
          class="mt-3 font-display text-3xl font-bold tracking-tight text-balance text-brand-50 md:text-4xl"
        >
          {{ 'no_encontrada.titulo' | transloco }}
        </h1>
        <p class="mt-4 text-base text-balance text-brand-200">
          {{ 'no_encontrada.texto' | transloco }}
        </p>
        <a
          hk-button
          tamano="lg"
          icono="house"
          routerLink="/dashboard"
          class="mt-10 bg-brand-50! text-brand-950! hover:bg-white!"
        >
          {{ 'comun.volver_inicio' | transloco }}
        </a>
      </div>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoEncontradaPage {}
