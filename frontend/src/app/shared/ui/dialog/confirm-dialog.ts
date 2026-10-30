import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';

import { HkButton } from '../button/button';
import { HkFormField } from '../forms/form-field';
import { HkTextarea } from '../forms/textarea';
import { DialogosService } from './dialogos.service';
import { HkModal } from './modal';

export interface OpcionesConfirmacion {
  /** Textos ya traducidos. */
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  /** Acción destructiva: botón rojo e ícono de advertencia. */
  peligrosa?: boolean;
  /** Pide escribir el motivo (p. ej. anular una venta, cancelar una orden). */
  pedirMotivo?: boolean;
  /** Longitud mínima del motivo; por defecto 5. */
  minimoMotivo?: number;
}

export interface ResultadoConfirmacion {
  motivo?: string;
}

@Component({
  selector: 'hk-confirm-dialog',
  imports: [HkModal, HkButton, HkFormField, HkTextarea, LucideDynamicIcon, TranslocoPipe],
  template: `
    <hk-modal [titulo]="datos.titulo">
      <div class="flex gap-4">
        @if (datos.peligrosa) {
          <span
            class="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-ink"
          >
            <svg lucideIcon="triangle-alert" class="size-5" aria-hidden="true" />
          </span>
        }
        <div class="min-w-0 flex-1 space-y-4">
          <p class="text-sm leading-relaxed text-fg">{{ datos.mensaje }}</p>
          @if (datos.pedirMotivo) {
            <hk-form-field
              [etiqueta]="'ui.confirmar.motivo' | transloco"
              [ayuda]="'ui.confirmar.motivo_ayuda' | transloco: { min: minimo }"
            >
              <hk-textarea [filas]="3" [maxCaracteres]="500" [(valor)]="motivo" />
            </hk-form-field>
          }
        </div>
      </div>
      <div hkModalPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button
          hk-button
          [variante]="datos.peligrosa ? 'danger' : 'primary'"
          [deshabilitado]="!puedeConfirmar()"
          (click)="confirmar()"
        >
          {{ datos.textoConfirmar ?? ('comun.confirmar' | transloco) }}
        </button>
      </div>
    </hk-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkConfirmDialog {
  protected readonly datos = inject<OpcionesConfirmacion>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ResultadoConfirmacion>>(DialogRef);
  protected readonly minimo = this.datos.minimoMotivo ?? 5;
  protected readonly motivo = signal<string | null>(null);

  protected readonly puedeConfirmar = computed(
    () => !this.datos.pedirMotivo || (this.motivo()?.trim().length ?? 0) >= this.minimo,
  );

  protected confirmar(): void {
    if (!this.puedeConfirmar()) return;
    this.ref.close(this.datos.pedirMotivo ? { motivo: this.motivo()!.trim() } : {});
  }
}

/** `const r = await confirmacion.pedir({...}); if (r) { ... r.motivo }` — `null` si se canceló. */
@Injectable({ providedIn: 'root' })
export class ConfirmacionService {
  private readonly dialogos = inject(DialogosService);

  async pedir(opciones: OpcionesConfirmacion): Promise<ResultadoConfirmacion | null> {
    const ref = this.dialogos.abrirModal<
      HkConfirmDialog,
      OpcionesConfirmacion,
      ResultadoConfirmacion
    >(HkConfirmDialog, { datos: opciones, tamano: 'sm' });
    return (await firstValueFrom(ref.closed)) ?? null;
  }
}
