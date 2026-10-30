import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { erroresManejados } from '../../core/http/contexto-http';
import { CantidadPipe, CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ColumnaTabla, HkCelda, HkTable } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast';
import { Compra, ComprasApiService } from './compras-api.service';
import { HkEstadoCompra } from './estado-compra';

/**
 * Detalle de una compra (RF21): factura, ítems con el stock actual de cada producto y la
 * anulación con motivo (RN-17), que solo procede si hay disponible para devolver todo.
 */
@Component({
  selector: 'hk-compra-detalle-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    CantidadPipe,
    CopPipe,
    FechaPipe,
    HkButton,
    HkCard,
    HkEmptyState,
    HkEstadoCompra,
    HkPageHeader,
    HkSkeleton,
    HkTable,
    HkCelda,
  ],
  template: `
    @if (compra.error()) {
      <hk-empty-state
        class="mt-10"
        icono="truck"
        [titulo]="'compras.detalle.no_encontrada' | transloco"
        [texto]="'compras.detalle.no_encontrada_texto' | transloco"
      >
        <a hk-button variante="secondary" icono="chevron-left" routerLink="/compras">
          {{ 'compras.detalle.volver' | transloco }}
        </a>
      </hk-empty-state>
    } @else if (compra.value(); as c) {
      <hk-page-header
        [titulo]="'compras.detalle.titulo' | transloco: { numero: c.numero }"
        [subtitulo]="c.proveedor.razonSocial"
      >
        <a hk-button variante="secondary" icono="chevron-left" routerLink="/compras">
          {{ 'compras.titulo' | transloco }}
        </a>
        @if (c.estado === 'REGISTRADA') {
          <button hk-button variante="danger" icono="circle-x" (click)="anular(c)">
            {{ 'compras.anular' | transloco }}
          </button>
        }
      </hk-page-header>

      @if (c.estado === 'ANULADA') {
        <div
          class="mb-6 rounded-2xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger-ink"
          role="status"
        >
          <p class="font-semibold">
            {{
              'compras.detalle.anulada'
                | transloco
                  : {
                      fecha: (c.anuladaEn | fecha: 'fechaHora'),
                      nombre: c.anuladaPor?.nombre ?? '—',
                    }
            }}
          </p>
          <p class="mt-1">{{ c.motivoAnulacion }}</p>
        </div>
      }

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <hk-card
          [titulo]="'compras.items' | transloco"
          [subtitulo]="'compras.detalle.efecto_stock' | transloco"
        >
          <hk-table
            [columnas]="columnas()"
            [filas]="c.items"
            [etiqueta]="'compras.items' | transloco"
          >
            <ng-template hkCelda="producto" let-i>
              <a
                class="rounded font-medium text-fg hk-foco hover:text-primary hover:underline"
                [routerLink]="['/inventario/productos', i.producto.id]"
                >{{ i.producto.nombre }}</a
              >
              <p class="font-mono text-xs text-muted">{{ i.producto.codigo }}</p>
            </ng-template>
            <ng-template hkCelda="cantidad" let-i>
              <span class="tabular">{{ i.cantidad | cantidad }}</span>
            </ng-template>
            <ng-template hkCelda="costoUnitario" let-i>
              <span class="tabular">{{ i.costoUnitario | cop }}</span>
            </ng-template>
            <ng-template hkCelda="subtotal" let-i>
              <span class="font-medium tabular">{{ i.subtotal | cop }}</span>
            </ng-template>
            <ng-template hkCelda="stock" let-i>
              <span class="tabular">{{ i.producto.stockActual | cantidad }}</span>
              <p class="text-xs text-muted">
                {{
                  'compras.detalle.costo_actual'
                    | transloco: { costo: (i.producto.costoPromedio | cop) }
                }}
              </p>
            </ng-template>
          </hk-table>
        </hk-card>

        <div class="flex flex-col gap-6">
          <hk-card [titulo]="'compras.factura' | transloco">
            <div class="mb-4"><hk-estado-compra [estado]="c.estado" /></div>
            <dl class="space-y-3 text-sm">
              <div>
                <dt class="text-xs text-muted">{{ 'compras.campos.proveedor' | transloco }}</dt>
                <dd>
                  <a
                    class="rounded font-medium text-fg hk-foco hover:underline"
                    [routerLink]="['/proveedores', c.proveedor.id]"
                  >
                    {{ c.proveedor.razonSocial }}
                  </a>
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ 'compras.campos.factura' | transloco }}</dt>
                <dd class="font-medium text-fg">{{ c.numeroFacturaProveedor }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ 'compras.campos.fecha' | transloco }}</dt>
                <dd class="font-medium text-fg">{{ c.fecha | fecha }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">
                  {{ 'compras.detalle.registrada_por' | transloco }}
                </dt>
                <dd class="font-medium text-fg">
                  {{ c.registradaPor?.nombre ?? '—' }} · {{ c.createdAt | fecha: 'fechaHora' }}
                </dd>
              </div>
            </dl>
          </hk-card>
          <hk-card [titulo]="'compras.totales' | transloco">
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted">{{ 'compras.subtotal' | transloco }}</dt>
                <dd class="font-medium text-fg tabular">{{ c.subtotal | cop }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-muted">
                  {{ 'compras.iva' | transloco: { porcentaje: c.ivaPorcentaje } }}
                </dt>
                <dd class="font-medium text-fg tabular">{{ c.impuesto | cop }}</dd>
              </div>
              <div class="flex justify-between border-t border-border pt-3 text-base">
                <dt class="font-semibold text-fg">{{ 'compras.total' | transloco }}</dt>
                <dd class="font-display text-xl font-bold text-fg tabular">{{ c.total | cop }}</dd>
              </div>
            </dl>
          </hk-card>
        </div>
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
export class CompraDetallePage {
  private readonly api = inject(ComprasApiService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly compra = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.obtener(params, erroresManejados()),
  });

  private readonly textos = translateSignal([
    'compras.campos.producto_columna',
    'compras.campos.cantidad',
    'compras.campos.costo',
    'compras.subtotal',
    'compras.detalle.stock_actual',
  ]);
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [producto, cantidad, costo, subtotal, stock] = this.textos();
    return [
      { clave: 'producto', etiqueta: producto, principal: true },
      { clave: 'cantidad', etiqueta: cantidad, numerica: true },
      { clave: 'costoUnitario', etiqueta: costo, numerica: true },
      { clave: 'subtotal', etiqueta: subtotal, numerica: true },
      { clave: 'stock', etiqueta: stock, numerica: true, ocultarEnMovil: true },
    ];
  });

  protected async anular(compra: Compra): Promise<void> {
    const resultado = await this.confirmacion.pedir({
      titulo: this.transloco.translate('compras.confirmar_anular.titulo', {
        numero: compra.numero,
      }),
      mensaje: this.transloco.translate('compras.confirmar_anular.mensaje'),
      textoConfirmar: this.transloco.translate('compras.anular'),
      peligrosa: true,
      pedirMotivo: true,
    });
    if (!resultado?.motivo) return;
    this.api.anular(compra.id, resultado.motivo).subscribe((anulada) => {
      this.toast.exito(this.transloco.translate('compras.anulada', { numero: anulada.numero }));
      this.compra.set(anulada);
    });
  }
}
