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

import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
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
import { HkEstadoVenta } from './estado-venta';
import { Venta, VentasApiService } from './ventas-api.service';

/** Detalle de una venta: ítems, pago y anulación con motivo (RN-21) para quien tiene `VENTAS_ANULAR`. */
@Component({
  selector: 'hk-venta-detalle-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    CantidadPipe,
    CopPipe,
    FechaPipe,
    HkTienePermisoDirective,
    HkButton,
    HkCard,
    HkEmptyState,
    HkEstadoVenta,
    HkPageHeader,
    HkSkeleton,
    HkTable,
    HkCelda,
  ],
  template: `
    @if (venta.error()) {
      <hk-empty-state
        class="mt-10"
        icono="shopping-cart"
        [titulo]="'ventas.detalle.no_encontrada' | transloco"
        [texto]="'compras.detalle.no_encontrada_texto' | transloco"
      >
        <a hk-button variante="secondary" icono="chevron-left" routerLink="/ventas">
          {{ 'ventas.detalle.volver' | transloco }}
        </a>
      </hk-empty-state>
    } @else if (venta.value(); as v) {
      <hk-page-header
        [titulo]="'ventas.detalle.titulo' | transloco: { numero: v.numero }"
        [subtitulo]="v.fecha | fecha: 'fechaHora'"
      >
        <a
          hk-button
          variante="secondary"
          icono="printer"
          [routerLink]="['/ventas', v.id, 'comprobante']"
        >
          {{ 'ventas.comprobante' | transloco }}
        </a>
        @if (v.estado === 'PAGADA') {
          <button
            *hkTienePermiso="'VENTAS_ANULAR'"
            hk-button
            variante="danger"
            icono="circle-x"
            (click)="anular(v)"
          >
            {{ 'ventas.anular' | transloco }}
          </button>
        }
      </hk-page-header>

      @if (v.estado === 'ANULADA') {
        <div
          class="mb-6 rounded-2xl border border-danger/40 bg-danger-soft p-4 text-sm text-danger-ink"
          role="status"
        >
          <p class="font-semibold">
            {{
              'compras.detalle.anulada'
                | transloco
                  : {
                      fecha: (v.anuladaEn | fecha: 'fechaHora'),
                      nombre: v.anuladaPor?.nombre ?? '—',
                    }
            }}
          </p>
          <p class="mt-1">{{ v.motivoAnulacion }}</p>
        </div>
      }

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <hk-card [titulo]="'compras.items' | transloco">
          <hk-table
            [columnas]="columnas()"
            [filas]="v.items"
            [etiqueta]="'compras.items' | transloco"
          >
            <ng-template hkCelda="nombre" let-i>
              <a
                class="rounded font-medium text-fg hk-foco hover:underline"
                [routerLink]="['/inventario/productos', i.productoId]"
              >
                {{ i.nombre }}
              </a>
              <p class="font-mono text-xs text-muted">{{ i.codigo }}</p>
            </ng-template>
            <ng-template hkCelda="cantidad" let-i
              ><span class="tabular">{{ i.cantidad | cantidad }}</span></ng-template
            >
            <ng-template hkCelda="precioUnitario" let-i
              ><span class="tabular">{{ i.precioUnitario | cop }}</span></ng-template
            >
            <ng-template hkCelda="subtotal" let-i
              ><span class="font-medium tabular">{{ i.subtotal | cop }}</span></ng-template
            >
          </hk-table>
        </hk-card>

        <div class="flex flex-col gap-6">
          <hk-card [titulo]="'ventas.detalle.datos' | transloco">
            <div class="mb-4"><hk-estado-venta [estado]="v.estado" /></div>
            <dl class="space-y-3 text-sm">
              <div>
                <dt class="text-xs text-muted">{{ 'ventas.campos.cliente' | transloco }}</dt>
                <dd class="font-medium text-fg">
                  @if (v.cliente; as c) {
                    <a class="rounded hk-foco hover:underline" [routerLink]="['/clientes', c.id]">{{
                      c.nombreCompleto
                    }}</a>
                  } @else {
                    {{ 'ventas.consumidor_final' | transloco }}
                  }
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ 'ventas.campos.vendedor' | transloco }}</dt>
                <dd class="font-medium text-fg">{{ v.vendedor?.nombre ?? '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">{{ 'ventas.campos.metodo' | transloco }}</dt>
                <dd class="font-medium text-fg">
                  {{ 'ventas.metodos.' + v.metodoPago | transloco }}
                  @if (v.referenciaPago) {
                    · {{ v.referenciaPago }}
                  }
                </dd>
              </div>
              @if (v.montoRecibido !== null) {
                <div>
                  <dt class="text-xs text-muted">{{ 'ventas.campos.recibido' | transloco }}</dt>
                  <dd class="font-medium text-fg tabular">
                    {{ v.montoRecibido | cop }} · {{ 'ventas.pos.cambio' | transloco }}
                    {{ v.cambio | cop }}
                  </dd>
                </div>
              }
            </dl>
          </hk-card>
          <hk-card [titulo]="'compras.totales' | transloco">
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-muted">{{ 'compras.subtotal' | transloco }}</dt>
                <dd class="font-medium text-fg tabular">{{ v.subtotal | cop }}</dd>
              </div>
              @if (v.descuento > 0) {
                <div class="flex justify-between">
                  <dt class="text-muted">{{ 'ventas.campos.descuento' | transloco }}</dt>
                  <dd class="font-medium text-fg tabular">−{{ v.descuento | cop }}</dd>
                </div>
              }
              <div class="flex justify-between">
                <dt class="text-muted">
                  {{ 'compras.iva' | transloco: { porcentaje: v.ivaPorcentaje } }}
                </dt>
                <dd class="font-medium text-fg tabular">{{ v.impuesto | cop }}</dd>
              </div>
              <div class="flex justify-between border-t border-border pt-3 text-base">
                <dt class="font-semibold text-fg">{{ 'compras.total' | transloco }}</dt>
                <dd class="font-display text-xl font-bold text-fg tabular">{{ v.total | cop }}</dd>
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
export class VentaDetallePage {
  private readonly api = inject(VentasApiService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly venta = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.obtener(params, erroresManejados()),
  });

  private readonly textos = translateSignal([
    'compras.campos.producto_columna',
    'compras.campos.cantidad',
    'ventas.campos.precio',
    'compras.subtotal',
  ]);
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [producto, cantidad, precio, subtotal] = this.textos();
    return [
      { clave: 'nombre', etiqueta: producto, principal: true },
      { clave: 'cantidad', etiqueta: cantidad, numerica: true },
      { clave: 'precioUnitario', etiqueta: precio, numerica: true },
      { clave: 'subtotal', etiqueta: subtotal, numerica: true },
    ];
  });

  protected async anular(venta: Venta): Promise<void> {
    const resultado = await this.confirmacion.pedir({
      titulo: this.transloco.translate('ventas.confirmar_anular.titulo', { numero: venta.numero }),
      mensaje: this.transloco.translate('ventas.confirmar_anular.mensaje'),
      textoConfirmar: this.transloco.translate('ventas.anular'),
      peligrosa: true,
      pedirMotivo: true,
    });
    if (!resultado?.motivo) return;
    this.api.anular(venta.id, resultado.motivo).subscribe((anulada) => {
      this.toast.exito(this.transloco.translate('ventas.anulada', { numero: anulada.numero }));
      this.venta.set(anulada);
    });
  }
}
