import { ChangeDetectionStrategy, Component, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkBadge } from '../../shared/ui/badge/badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ToastService } from '../../shared/ui/toast/toast';
import { ComprasApiService } from '../compras/compras-api.service';
import { HkEstadoCompra } from '../compras/estado-compra';
import { DatosFormProveedor, ProveedorFormDrawer } from './proveedor-form-drawer';
import { Proveedor, ProveedoresApiService } from './proveedores-api.service';

/** Ficha del proveedor (RF20) con sus últimas compras. */
@Component({
  selector: 'hk-proveedor-detalle-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    CopPipe,
    FechaPipe,
    HkTienePermisoDirective,
    HkBadge,
    HkButton,
    HkCard,
    HkEmptyState,
    HkEstadoCompra,
    HkPageHeader,
    HkSkeleton,
  ],
  template: `
    @if (proveedor.error()) {
      <hk-empty-state
        class="mt-10"
        icono="building"
        [titulo]="'proveedores.detalle.no_encontrado' | transloco"
        [texto]="'proveedores.detalle.no_encontrado_texto' | transloco"
      >
        <a hk-button variante="secondary" icono="chevron-left" routerLink="/proveedores">
          {{ 'proveedores.detalle.volver' | transloco }}
        </a>
      </hk-empty-state>
    } @else if (proveedor.value(); as p) {
      <hk-page-header
        [titulo]="p.razonSocial"
        [subtitulo]="p.tipoDocumento + ' ' + p.numeroDocumento"
      >
        @if (p.activo) {
          <a
            *hkTienePermiso="'COMPRAS_GESTIONAR'"
            hk-button
            variante="secondary"
            icono="truck"
            routerLink="/compras/nueva"
            [queryParams]="{ proveedorId: p.id }"
          >
            {{ 'compras.nueva' | transloco }}
          </a>
        }
        <button hk-button variante="secondary" icono="pencil" (click)="editar(p)">
          {{ 'comun.editar' | transloco }}
        </button>
        <button hk-button variante="secondary" icono="power" (click)="cambiarEstado(p)">
          {{ (p.activo ? 'comun.desactivar' : 'comun.activar') | transloco }}
        </button>
      </hk-page-header>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <hk-card [titulo]="'proveedores.detalle.datos' | transloco">
          <hk-badge
            class="mb-4 inline-block"
            [tono]="p.activo ? 'success' : 'neutral'"
            [icono]="p.activo ? 'circle-check' : 'circle-x'"
          >
            {{ (p.activo ? 'comun.estado.activo' : 'comun.estado.inactivo') | transloco }}
          </hk-badge>
          <dl class="grid gap-4 sm:grid-cols-2">
            @for (dato of datos(p); track dato.clave) {
              <div class="min-w-0">
                <dt class="text-xs text-muted">{{ dato.clave | transloco }}</dt>
                <dd class="font-medium break-words text-fg">
                  {{ dato.valor ?? ('comun.sin_dato' | transloco) }}
                </dd>
              </div>
            }
          </dl>
        </hk-card>

        <hk-card
          *hkTienePermiso="'COMPRAS_GESTIONAR'"
          [titulo]="'proveedores.detalle.compras' | transloco"
        >
          @if (compras.isLoading() && !compras.value()) {
            <hk-skeleton [lineas]="4" />
          } @else if ((compras.value()?.content ?? []).length === 0) {
            <hk-empty-state
              compacto
              icono="truck"
              [titulo]="'proveedores.detalle.sin_compras' | transloco"
            />
          } @else {
            <ul class="divide-y divide-border">
              @for (c of compras.value()?.content ?? []; track c.id) {
                <li>
                  <a
                    class="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hk-foco hover:bg-surface-2"
                    [routerLink]="['/compras', c.id]"
                  >
                    <span class="min-w-0">
                      <span class="block font-medium text-fg">{{ c.numero }}</span>
                      <span class="text-xs text-muted">
                        {{ c.fecha | fecha }} · {{ 'compras.campos.factura_corta' | transloco }}
                        {{ c.numeroFacturaProveedor }}
                      </span>
                    </span>
                    <span class="flex shrink-0 items-center gap-3">
                      <hk-estado-compra [estado]="c.estado" />
                      <span class="font-semibold text-fg tabular">{{ c.total | cop }}</span>
                    </span>
                  </a>
                </li>
              }
            </ul>
          }
        </hk-card>
      </div>
    } @else {
      <div class="space-y-6" aria-busy="true">
        <hk-skeleton ancho="40%" alto="2rem" />
        <hk-skeleton variante="rectangulo" alto="14rem" />
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProveedorDetallePage {
  private readonly api = inject(ProveedoresApiService);
  private readonly comprasApi = inject(ComprasApiService);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly proveedor = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.obtener(params, erroresManejados()),
  });
  protected readonly compras = rxResource({
    params: () => this.id(),
    stream: ({ params }) =>
      this.comprasApi.listar(
        {
          proveedorId: params,
          desde: null,
          hasta: null,
          estado: null,
          numero: '',
          page: 0,
          size: 10,
        },
        erroresManejados(),
      ),
  });

  protected datos(p: Proveedor): { clave: string; valor: string | null }[] {
    return [
      { clave: 'proveedores.campos.contacto', valor: p.contacto },
      { clave: 'proveedores.campos.telefono', valor: p.telefono },
      { clave: 'proveedores.campos.email', valor: p.email },
      { clave: 'proveedores.campos.direccion', valor: p.direccion },
    ];
  }

  protected editar(proveedor: Proveedor): void {
    this.dialogos
      .abrirDrawer<ProveedorFormDrawer, DatosFormProveedor, Proveedor>(ProveedorFormDrawer, {
        datos: { proveedor },
      })
      .closed.subscribe((guardado) => {
        if (!guardado) return;
        this.toast.exito(
          this.transloco.translate('proveedores.actualizado', { nombre: guardado.razonSocial }),
        );
        this.proveedor.set(guardado);
      });
  }

  protected async cambiarEstado(proveedor: Proveedor): Promise<void> {
    const activo = !proveedor.activo;
    const prefijo = activo ? 'proveedores.confirmar_activar' : 'proveedores.confirmar_desactivar';
    const confirmado = await this.confirmacion.pedir({
      titulo: this.transloco.translate(`${prefijo}.titulo`),
      mensaje: this.transloco.translate(`${prefijo}.mensaje`, { nombre: proveedor.razonSocial }),
      textoConfirmar: this.transloco.translate(activo ? 'comun.activar' : 'comun.desactivar'),
      peligrosa: !activo,
    });
    if (!confirmado) return;
    this.api.cambiarEstado(proveedor.id, activo).subscribe((actualizado) => {
      this.toast.exito(
        this.transloco.translate(activo ? 'proveedores.activado' : 'proveedores.desactivado', {
          nombre: actualizado.razonSocial,
        }),
      );
      this.proveedor.set(actualizado);
    });
  }
}
