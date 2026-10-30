import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Página temporal de inicio hasta que llegue el layout (F04A). */
@Component({
  selector: 'hk-inicio-page',
  imports: [TranslocoPipe],
  template: `
    <main class="flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <img src="brand/logo.svg" [alt]="'app.nombre' | transloco" class="h-16 w-auto" />
      <h1 class="text-2xl font-bold">{{ 'app.nombre' | transloco }}</h1>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InicioPage {}
