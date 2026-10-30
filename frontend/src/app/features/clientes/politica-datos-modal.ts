import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { HkButton } from '../../shared/ui/button/button';
import { HkModal } from '../../shared/ui/dialog/modal';

const PARRAFOS = ['p1', 'p2', 'p3', 'p4'] as const;

/**
 * Texto de autorización de tratamiento de datos (Ley 1581 de 2012, RN-45). Por ahora sale de
 * las traducciones; la configuración del taller (F11) podrá reemplazarlo.
 */
@Component({
  selector: 'hk-politica-datos-modal',
  imports: [TranslocoPipe, HkButton, HkModal],
  template: `
    <hk-modal [titulo]="'clientes.politica.titulo' | transloco">
      <div class="space-y-3 text-sm leading-relaxed text-fg">
        @for (parrafo of parrafos; track parrafo) {
          <p>{{ 'clientes.politica.' + parrafo | transloco }}</p>
        }
      </div>
      <div hkModalPie class="contents">
        <button hk-button (click)="ref.close()">{{ 'comun.entendido' | transloco }}</button>
      </div>
    </hk-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoliticaDatosModal {
  protected readonly ref = inject(DialogRef);
  protected readonly parrafos = PARRAFOS;
}
