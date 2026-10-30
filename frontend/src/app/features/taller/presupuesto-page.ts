import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  numberAttribute,
  ViewEncapsulation,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { erroresManejados } from '../../core/http/contexto-http';
import { CantidadPipe, CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { OrdenesApiService } from './ordenes-api.service';

/**
 * Presupuesto imprimible (RF22) fuera del layout, con el estilo del comprobante de venta: datos del
 * taller, cliente, moto, ítems congelados, totales y la leyenda de documento interno. El papel es
 * siempre claro, también en tema oscuro.
 */
@Component({
  selector: 'hk-presupuesto-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    CantidadPipe,
    CopPipe,
    FechaPipe,
    HkButton,
    HkEmptyState,
    HkSkeleton,
  ],
  // Sin encapsulación: las reglas de @page y de impresión deben aplicar a todo el documento.
  encapsulation: ViewEncapsulation.None,
  styles: `
    .hk-documento {
      --surface: #ffffff;
      --surface-2: #f0f4fb;
      --border: #e2e8f3;
      --fg: #0f1d3f;
      --muted: #4a5878;
      background: var(--surface);
      color: var(--fg);
    }
    @media print {
      body {
        background: #ffffff;
      }
      .hk-no-imprimir {
        display: none !important;
      }
      .hk-pagina-documento {
        padding: 0 !important;
      }
      .hk-documento {
        box-shadow: none !important;
        border: 0 !important;
        margin: 0 !important;
        max-width: none !important;
      }
    }
  `,
  template: `
    <div class="hk-pagina-documento min-h-dvh bg-bg px-4 py-6">
      @if (documento.value(); as d) {
        <div
          class="hk-no-imprimir mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-3"
        >
          <a
            hk-button
            variante="secondary"
            icono="chevron-left"
            [routerLink]="['/ordenes', d.presupuesto.ordenId]"
          >
            {{ 'taller.presupuestos.volver' | transloco }}
          </a>
          <button hk-button icono="printer" (click)="imprimir()">
            {{ 'ventas.imprimir' | transloco }}
          </button>
        </div>
        <article
          class="hk-documento mx-auto max-w-3xl rounded-2xl border border-border p-8 shadow-card"
          [attr.aria-label]="
            'taller.presupuestos.documento_de' | transloco: { numero: d.presupuesto.numero }
          "
        >
          <header
            class="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5"
          >
            <div>
              <img src="brand/logo.svg" alt="HYSKAD" class="h-8" />
              <p class="mt-3 font-semibold">{{ d.taller.nombre }}</p>
              <p class="text-sm text-muted">NIT {{ d.taller.nit }}</p>
              <p class="text-sm text-muted">{{ d.taller.direccion }}</p>
              <p class="text-sm text-muted">{{ d.taller.telefono }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs font-semibold tracking-wider text-muted uppercase">
                {{ 'taller.presupuestos.titulo_documento' | transloco }}
              </p>
              <p class="font-display text-2xl font-bold">{{ d.presupuesto.numero }}</p>
              <p class="text-sm text-muted">
                {{ 'taller.presupuestos.version' | transloco: { version: d.presupuesto.version } }}
                · {{ d.numeroOrden }}
              </p>
              <p class="text-sm text-muted">{{ d.presupuesto.fechaEnvio | fecha: 'fechaHora' }}</p>
              <p class="mt-1 text-sm font-semibold">
                {{ 'taller.presupuestos.estados.' + d.presupuesto.estado | transloco }}
              </p>
            </div>
          </header>

          <section class="grid gap-4 border-b border-border py-4 text-sm sm:grid-cols-2">
            <div>
              <p class="text-xs text-muted">{{ 'taller.campos.cliente' | transloco }}</p>
              <p class="font-medium">{{ d.cliente.nombreCompleto }}</p>
              <p class="text-muted">
                {{ d.cliente.tipoDocumento }} {{ d.cliente.numeroDocumento }} ·
                {{ d.cliente.telefono }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted">{{ 'taller.campos.moto' | transloco }}</p>
              <p class="font-medium">{{ d.moto.placa }} · {{ d.moto.marca }} {{ d.moto.modelo }}</p>
              @if (d.moto.anio) {
                <p class="text-muted">{{ d.moto.anio }}</p>
              }
            </div>
          </section>

          <table class="w-full border-b border-border text-sm">
            <thead>
              <tr class="text-left text-xs text-muted">
                <th scope="col" class="py-2 font-medium">
                  {{ 'taller.items.descripcion' | transloco }}
                </th>
                <th scope="col" class="py-2 pl-3 text-right font-medium">
                  {{ 'taller.items.cantidad' | transloco }}
                </th>
                <th scope="col" class="py-2 pl-3 text-right font-medium">
                  {{ 'taller.items.precio' | transloco }}
                </th>
                <th scope="col" class="py-2 pl-3 text-right font-medium">
                  {{ 'compras.subtotal' | transloco }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (i of d.presupuesto.items; track $index) {
                <tr class="border-t border-border align-top">
                  <td class="py-2 pr-2">{{ i.descripcion }}</td>
                  <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                    {{ i.cantidad | cantidad }}
                  </td>
                  <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                    {{ i.precioUnitario | cop }}
                  </td>
                  <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                    {{ i.subtotal | cop }}
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <dl class="ml-auto max-w-xs space-y-1 py-4 text-sm">
            <div class="flex justify-between gap-6">
              <dt class="text-muted">{{ 'compras.subtotal' | transloco }}</dt>
              <dd class="tabular">{{ d.presupuesto.subtotal | cop }}</dd>
            </div>
            @if (d.presupuesto.descuento > 0) {
              <div class="flex justify-between gap-6">
                <dt class="text-muted">{{ 'ventas.campos.descuento' | transloco }}</dt>
                <dd class="tabular">−{{ d.presupuesto.descuento | cop }}</dd>
              </div>
            }
            <div class="flex justify-between gap-6">
              <dt class="text-muted">
                {{ 'compras.iva' | transloco: { porcentaje: d.presupuesto.ivaPorcentaje } }}
              </dt>
              <dd class="tabular">{{ d.presupuesto.impuesto | cop }}</dd>
            </div>
            <div class="flex justify-between gap-6 border-t border-border pt-2 text-base font-bold">
              <dt>{{ 'compras.total' | transloco }}</dt>
              <dd class="tabular">{{ d.presupuesto.total | cop }}</dd>
            </div>
          </dl>

          @if (d.presupuesto.observaciones) {
            <p class="mb-4 text-sm text-muted">{{ d.presupuesto.observaciones }}</p>
          }
          <p class="rounded-lg bg-surface-2 px-3 py-2 text-center text-sm font-semibold">
            {{ d.leyenda }}
          </p>
        </article>
      } @else if (documento.error()) {
        <hk-empty-state
          icono="circle-alert"
          [titulo]="'taller.presupuestos.no_encontrado' | transloco"
        >
          <a hk-button variante="secondary" icono="chevron-left" routerLink="/ordenes">
            {{ 'taller.detalle.volver' | transloco }}
          </a>
        </hk-empty-state>
      } @else {
        <div class="mx-auto max-w-3xl"><hk-skeleton variante="rectangulo" alto="28rem" /></div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PresupuestoPage {
  private readonly api = inject(OrdenesApiService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly documento = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.documentoPresupuesto(params, erroresManejados()),
  });

  protected imprimir(): void {
    window.print();
  }
}
