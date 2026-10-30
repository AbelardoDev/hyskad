import { DialogRef } from '@angular/cdk/dialog';
import { booleanAttribute, ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { HkIconButton } from '../button/icon-button';
import { nuevoId } from '../forms/campo';
import { HK_ID_TITULO_DIALOGO } from './dialogos.service';

/** Panel lateral abierto con `DialogosService.abrirDrawer`. Pie opcional con `<div hkDrawerPie>`. */
@Component({
  selector: 'hk-drawer',
  imports: [HkIconButton, TranslocoPipe],
  template: `
    <header class="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
      <h2 [id]="idTitulo" class="font-display text-lg font-semibold tracking-tight text-fg">
        {{ titulo() }}
      </h2>
      @if (cerrable()) {
        <button
          hk-icon-button
          icono="x"
          tamano="sm"
          class="-mr-2"
          [etiqueta]="'comun.cerrar' | transloco"
          (click)="cerrar()"
        ></button>
      }
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <ng-content />
    </div>
    <footer
      class="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3.5 empty:hidden"
    >
      <ng-content select="[hkDrawerPie]" />
    </footer>
  `,
  host: {
    class: 'flex h-dvh flex-col border-l border-border bg-surface text-fg shadow-overlay',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkDrawer {
  private readonly dialogRef = inject(DialogRef, { optional: true });

  readonly titulo = input.required<string>();
  readonly cerrable = input(true, { transform: booleanAttribute });

  protected readonly idTitulo =
    inject(HK_ID_TITULO_DIALOGO, { optional: true }) ?? nuevoId('hk-drawer-titulo');

  cerrar(): void {
    this.dialogRef?.close();
  }
}
