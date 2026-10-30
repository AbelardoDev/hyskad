import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { HkButton } from '../../shared/ui/button/button';
import { HkDrawer } from '../../shared/ui/dialog/drawer';
import { HkModal } from '../../shared/ui/dialog/modal';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkSwitch } from '../../shared/ui/forms/switch';
import { HkTextarea } from '../../shared/ui/forms/textarea';

/** Modal de ejemplo para la galería. */
@Component({
  selector: 'hk-demo-modal',
  imports: [HkModal, HkButton, HkFormField, HkTextarea, TranslocoPipe],
  template: `
    <hk-modal
      [titulo]="'devUi.overlays.modal_titulo' | transloco"
      [descripcion]="'devUi.overlays.modal_texto' | transloco"
    >
      <hk-form-field [etiqueta]="'devUi.form.observaciones' | transloco">
        <hk-textarea [filas]="4" />
      </hk-form-field>
      <div hkModalPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button hk-button (click)="ref.close()">{{ 'comun.guardar' | transloco }}</button>
      </div>
    </hk-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoModal {
  protected readonly ref = inject(DialogRef);
}

/** Drawer de ejemplo para la galería. */
@Component({
  selector: 'hk-demo-drawer',
  imports: [HkDrawer, HkButton, HkSwitch, TranslocoPipe],
  template: `
    <hk-drawer [titulo]="'devUi.overlays.drawer_titulo' | transloco">
      <p class="text-sm text-muted">{{ 'devUi.overlays.drawer_texto' | transloco }}</p>
      <div class="mt-6">
        <hk-switch [valor]="true">{{ 'devUi.form.notificar' | transloco }}</hk-switch>
      </div>
      <div hkDrawerPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cerrar' | transloco }}
        </button>
      </div>
    </hk-drawer>
  `,
  host: { class: 'block h-dvh' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoDrawer {
  protected readonly ref = inject(DialogRef);
}
