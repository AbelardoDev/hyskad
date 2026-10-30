import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize } from 'rxjs';

import { erroresManejados } from '../../core/http/contexto-http';
import { HkButton } from '../../shared/ui/button/button';
import { HkModal } from '../../shared/ui/dialog/modal';
import { HkCheckbox } from '../../shared/ui/forms/checkbox';
import { HkInput } from '../../shared/ui/forms/input';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { MAX_MECANICOS, Orden, OrdenesApiService } from './ordenes-api.service';

/**
 * Asignar o quitar mecánicos de una orden activa (RN-26), cada uno con su actividad opcional.
 * Cierra con la orden actualizada.
 */
@Component({
  selector: 'hk-mecanicos-modal',
  imports: [TranslocoPipe, HkButton, HkCheckbox, HkInput, HkModal, HkSkeleton],
  template: `
    <hk-modal [titulo]="'taller.mecanicos.titulo' | transloco: { numero: orden.numero }">
      @if (mecanicos.isLoading()) {
        <hk-skeleton variante="rectangulo" alto="6rem" />
      } @else if ((mecanicos.value() ?? []).length === 0) {
        <p class="text-sm text-muted">{{ 'taller.mecanicos.ninguno_disponible' | transloco }}</p>
      } @else {
        <ul class="space-y-3">
          @for (m of mecanicos.value(); track m.id) {
            <li class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <hk-checkbox
                class="sm:w-48"
                [valor]="elegidos().has(m.id)"
                [deshabilitado]="!elegidos().has(m.id) && elegidos().size >= maxMecanicos"
                (valorChange)="alternar(m.id, $event)"
              >
                {{ m.nombre }}
              </hk-checkbox>
              @if (elegidos().has(m.id)) {
                <hk-input
                  class="sm:flex-1"
                  [placeholder]="'taller.mecanicos.actividad_placeholder' | transloco"
                  [etiquetaAccesible]="
                    'taller.mecanicos.actividad_de' | transloco: { nombre: m.nombre }
                  "
                  [maxCaracteres]="200"
                  [valor]="elegidos().get(m.id) ?? ''"
                  (valorChange)="cambiarActividad(m.id, $event)"
                />
              }
            </li>
          }
        </ul>
      }
      <div hkModalPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button hk-button icono="check" [cargando]="guardando()" (click)="guardar()">
          {{ 'comun.guardar' | transloco }}
        </button>
      </div>
    </hk-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MecanicosModal {
  private readonly api = inject(OrdenesApiService);
  protected readonly ref = inject<DialogRef<Orden>>(DialogRef);
  protected readonly orden = inject<Orden>(DIALOG_DATA);
  protected readonly maxMecanicos = MAX_MECANICOS;
  protected readonly guardando = signal(false);

  protected readonly mecanicos = rxResource({
    stream: () => this.api.mecanicos(erroresManejados()),
  });
  /** Mecánico → actividad; arranca con los asignados. */
  protected readonly elegidos = signal<ReadonlyMap<number, string>>(
    new Map(this.orden.mecanicos.map((m) => [m.id, m.actividad ?? ''])),
  );

  protected alternar(id: number, elegido: boolean): void {
    this.elegidos.update((actual) => {
      const nuevo = new Map(actual);
      if (elegido) nuevo.set(id, '');
      else nuevo.delete(id);
      return nuevo;
    });
  }

  protected cambiarActividad(id: number, actividad: string | null): void {
    this.elegidos.update((actual) => new Map(actual).set(id, actividad ?? ''));
  }

  protected guardar(): void {
    if (this.guardando()) return;
    this.guardando.set(true);
    this.api
      .asignarMecanicos(
        this.orden,
        [...this.elegidos()].map(([mecanicoId, actividad]) => ({
          mecanicoId,
          actividad: actividad.trim() || null,
        })),
      )
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe((actualizada) => this.ref.close(actualizada));
  }
}
