import { DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs';

import { erroresManejados } from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import { HkBadge } from '../../shared/ui/badge/badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkIconButton } from '../../shared/ui/button/icon-button';
import { HkModal } from '../../shared/ui/dialog/modal';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ToastService } from '../../shared/ui/toast/toast';
import { Categoria, InventarioApiService } from './inventario-api.service';

/**
 * Gestión simple de categorías (RF17): crear, renombrar y activar/desactivar en el mismo modal.
 * Una categoría inactiva no se elige para productos nuevos; los suyos la conservan.
 */
@Component({
  selector: 'hk-categorias-modal',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkBadge,
    HkButton,
    HkEmptyState,
    HkFormField,
    HkIconButton,
    HkInput,
    HkModal,
    HkSkeleton,
  ],
  template: `
    <hk-modal
      [titulo]="'inventario.categorias.titulo' | transloco"
      [descripcion]="'inventario.categorias.descripcion' | transloco"
    >
      <form class="flex items-start gap-2" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <hk-form-field
          class="flex-1"
          [etiqueta]="
            (editando() ? 'inventario.categorias.renombrar' : 'inventario.categorias.nueva')
              | transloco
          "
        >
          <hk-input formControlName="nombre" autocompletar="off" [maxCaracteres]="80" />
        </hk-form-field>
        <div class="mt-6 flex gap-2">
          @if (editando()) {
            <button hk-button type="button" variante="ghost" (click)="cancelarEdicion()">
              {{ 'comun.cancelar' | transloco }}
            </button>
          }
          <button hk-button tipo="submit" [cargando]="guardando()">
            {{ (editando() ? 'comun.guardar' : 'inventario.categorias.crear') | transloco }}
          </button>
        </div>
      </form>

      <div class="mt-5">
        @if (categorias.isLoading() && !categorias.value()) {
          <hk-skeleton [lineas]="4" />
        } @else {
          <ul class="divide-y divide-border rounded-xl border border-border">
            @for (c of categorias.value() ?? []; track c.id) {
              <li class="flex items-center gap-3 px-4 py-2.5">
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-fg">{{
                  c.nombre
                }}</span>
                @if (!c.activo) {
                  <hk-badge tono="neutral">{{ 'comun.estado.inactiva' | transloco }}</hk-badge>
                }
                <button
                  hk-icon-button
                  icono="pencil"
                  tamano="sm"
                  [etiqueta]="'inventario.categorias.editar_de' | transloco: { nombre: c.nombre }"
                  (click)="editar(c)"
                ></button>
                <button
                  hk-icon-button
                  icono="power"
                  tamano="sm"
                  [etiqueta]="
                    (c.activo
                      ? 'inventario.categorias.desactivar_de'
                      : 'inventario.categorias.activar_de'
                    ) | transloco: { nombre: c.nombre }
                  "
                  (click)="cambiarEstado(c)"
                ></button>
              </li>
            } @empty {
              <li>
                <hk-empty-state
                  compacto
                  icono="tags"
                  [titulo]="'inventario.categorias.vacio' | transloco"
                />
              </li>
            }
          </ul>
        }
      </div>
      <div hkModalPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cerrar' | transloco }}
        </button>
      </div>
    </hk-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriasModal {
  private readonly api = inject(InventarioApiService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  protected readonly ref = inject(DialogRef);

  protected readonly categorias = rxResource({
    stream: () => this.api.categorias(null, erroresManejados()),
  });
  protected readonly editando = signal<Categoria | null>(null);
  protected readonly guardando = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
  });

  protected editar(categoria: Categoria): void {
    this.editando.set(categoria);
    this.form.setValue({ nombre: categoria.nombre });
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.form.reset({ nombre: '' });
  }

  protected guardar(): void {
    const control = this.form.controls.nombre;
    if (this.form.invalid) {
      control.markAsTouched();
      return;
    }
    if (this.guardando()) return;
    const actual = this.editando();
    const datos = { nombre: control.value.trim(), descripcion: actual?.descripcion ?? null };
    const peticion = actual
      ? this.api.actualizarCategoria(actual.id, datos, erroresManejados())
      : this.api.crearCategoria(datos, erroresManejados());
    this.guardando.set(true);
    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (guardada) => {
        this.toast.exito(
          this.transloco.translate(
            actual ? 'inventario.categorias.actualizada' : 'inventario.categorias.creada',
            { nombre: guardada.nombre },
          ),
        );
        this.cancelarEdicion();
        this.categorias.reload();
      },
      error: (e: HttpErrorResponse) => {
        control.setErrors({ servidor: codigoDeError(e) });
        control.markAsTouched();
      },
    });
  }

  protected cambiarEstado(categoria: Categoria): void {
    this.api.cambiarEstadoCategoria(categoria.id, !categoria.activo).subscribe(() => {
      this.categorias.reload();
    });
  }
}
