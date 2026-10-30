import { DialogRef } from '@angular/cdk/dialog';
import { booleanAttribute, ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { HkIconButton } from '../button/icon-button';
import { nuevoId } from '../forms/campo';
import { HK_ID_TITULO_DIALOGO } from './dialogos.service';

/**
 * Marco de un modal abierto con `DialogosService.abrirModal`: título, cuerpo con scroll y pie
 * (`<div hkModalPie>`). El título queda enlazado al `aria-labelledby` del diálogo.
 */
@Component({
  selector: 'hk-modal',
  imports: [HkIconButton, TranslocoPipe],
  template: `
    <header class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div class="min-w-0">
        <h2 [id]="idTitulo" class="font-display text-lg font-semibold tracking-tight text-fg">
          {{ titulo() }}
        </h2>
        @if (descripcion()) {
          <p class="mt-1 text-sm text-muted">{{ descripcion() }}</p>
        }
      </div>
      @if (cerrable()) {
        <button
          hk-icon-button
          icono="x"
          tamano="sm"
          class="-mt-1 -mr-2"
          [etiqueta]="'comun.cerrar' | transloco"
          (click)="cerrar()"
        ></button>
      }
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <ng-content />
    </div>
    <footer
      class="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3.5 empty:hidden"
    >
      <ng-content select="[hkModalPie]" />
    </footer>
  `,
  host: {
    class:
      'flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface text-fg shadow-overlay animate-entrada',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkModal {
  private readonly dialogRef = inject(DialogRef, { optional: true });

  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  readonly cerrable = input(true, { transform: booleanAttribute });

  protected readonly idTitulo =
    inject(HK_ID_TITULO_DIALOGO, { optional: true }) ?? nuevoId('hk-modal-titulo');

  cerrar(): void {
    this.dialogRef?.close();
  }
}
