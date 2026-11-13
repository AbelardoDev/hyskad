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
 * Comprobante de la orden (RF27, RN-06) fuera del layout, con el diseño base del comprobante de
 * venta: taller, cliente, moto y kilometraje, diagnóstico resumido, servicios, repuestos, totales,
 * pago, mecánicos y la leyenda de documento interno. El papel es siempre claro.
 */
@Component({
  selector: 'hk-comprobante-orden-page',
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
  // Sin encapsulación: las reglas de impresión deben aplicar a todo el documento.
  encapsulation: ViewEncapsulation.None,
  styles: `
    @page {
      size: letter;
      margin: 14mm;
    }
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
      <div
        class="hk-no-imprimir mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-3"
      >
        <a hk-button variante="secondary" icono="chevron-left" [routerLink]="['/ordenes', id()]">
          {{ 'taller.comprobante.volver' | transloco }}
        </a>
        <button
          hk-button
          icono="printer"
          [deshabilitado]="!comprobante.hasValue()"
          (click)="imprimir()"
        >
          {{ 'ventas.imprimir' | transloco }}
        </button>
      </div>

      @if (comprobante.error()) {
        <hk-empty-state
          icono="circle-alert"
          [titulo]="'taller.comprobante.no_disponible' | transloco"
          [texto]="'taller.comprobante.no_disponible_texto' | transloco"
        />
      } @else if (comprobante.value(); as c) {
        <article
          class="hk-documento mx-auto max-w-3xl rounded-2xl border border-border p-8 shadow-card"
          [attr.aria-label]="'taller.comprobante.de' | transloco: { numero: c.numero }"
        >
          <header
            class="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5"
          >
            <div>
              <img src="brand/logo.svg" alt="HYSKAD" class="h-8" />
              <p class="mt-3 font-semibold">{{ c.taller.nombre }}</p>
              <p class="text-sm text-muted">NIT {{ c.taller.nit }}</p>
              <p class="text-sm text-muted">{{ c.taller.direccion }}</p>
              <p class="text-sm text-muted">{{ c.taller.telefono }}</p>
            </div>
            <div class="text-right">
              <p class="text-xs font-semibold tracking-wider text-muted uppercase">
                {{ 'taller.comprobante.titulo' | transloco }}
              </p>
              <p class="font-display text-2xl font-bold">{{ c.numero }}</p>
              <p class="text-sm text-muted">
                {{ 'taller.comprobante.ingreso' | transloco: { fecha: (c.fechaIngreso | fecha) } }}
              </p>
              @if (c.fechaEntrega) {
                <p class="text-sm text-muted">
                  {{
                    'taller.comprobante.entrega'
                      | transloco: { fecha: (c.fechaEntrega | fecha: 'fechaHora') }
                  }}
                </p>
              }
            </div>
          </header>

          <section class="grid gap-4 border-b border-border py-4 text-sm sm:grid-cols-2">
            <div>
              <p class="text-xs text-muted">{{ 'taller.campos.cliente' | transloco }}</p>
              <p class="font-medium">{{ c.cliente.nombreCompleto }}</p>
              <p class="text-muted">
                {{ c.cliente.tipoDocumento }} {{ c.cliente.numeroDocumento }} ·
                {{ c.cliente.telefono }}
              </p>
            </div>
            <div>
              <p class="text-xs text-muted">{{ 'taller.campos.moto' | transloco }}</p>
              <p class="font-medium">{{ c.moto.placa }} · {{ c.moto.marca }} {{ c.moto.modelo }}</p>
              <p class="text-muted tabular">
                {{
                  'taller.comprobante.kilometraje'
                    | transloco
                      : { km: (c.kilometrajeInspeccion ?? c.kilometrajeIngreso | cantidad) }
                }}
              </p>
            </div>
            <div class="sm:col-span-2">
              <p class="text-xs text-muted">{{ 'taller.campos.motivo' | transloco }}</p>
              <p>{{ c.motivoIngreso }}</p>
              @if (c.diagnostico) {
                <p class="mt-2 text-xs text-muted">
                  {{ 'taller.detalle.pestanas.diagnostico' | transloco }}
                </p>
                <p class="whitespace-pre-line">{{ c.diagnostico }}</p>
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
              @for (s of c.servicios; track $index) {
                <tr class="border-t border-border align-top">
                  <td class="py-2 pr-2">{{ s.descripcion }}</td>
                  <td class="py-2 pl-3 text-right tabular">1</td>
                  <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                    {{ s.precio | cop }}
                  </td>
                  <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                    {{ s.precio | cop }}
                  </td>
                </tr>
              }
              @for (r of c.repuestos; track $index) {
                <tr class="border-t border-border align-top">
                  <td class="py-2 pr-2">
                    {{ r.nombre }} <span class="text-xs text-muted">· {{ r.codigo }}</span>
                  </td>
                  <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                    {{ r.cantidad | cantidad }}
                  </td>
                  <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                    {{ r.precioUnitario | cop }}
                  </td>
                  <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                    {{ r.subtotal | cop }}
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="flex flex-wrap items-start justify-between gap-6 py-4 text-sm">
            <div>
              <p class="text-xs text-muted">{{ 'taller.campos.mecanicos' | transloco }}</p>
              <p>{{ c.mecanicos.join(', ') || '—' }}</p>
            </div>
            <dl class="ml-auto w-full max-w-xs space-y-1">
              <div class="flex justify-between gap-6">
                <dt class="text-muted">{{ 'compras.subtotal' | transloco }}</dt>
                <dd class="tabular">{{ c.subtotal | cop }}</dd>
              </div>
              @if (c.descuento > 0) {
                <div class="flex justify-between gap-6">
                  <dt class="text-muted">{{ 'ventas.campos.descuento' | transloco }}</dt>
                  <dd class="tabular">−{{ c.descuento | cop }}</dd>
                </div>
              }
              <div class="flex justify-between gap-6">
                <dt class="text-muted">
                  {{ 'compras.iva' | transloco: { porcentaje: c.ivaPorcentaje } }}
                </dt>
                <dd class="tabular">{{ c.impuesto | cop }}</dd>
              </div>
              <div
                class="flex justify-between gap-6 border-t border-border pt-2 text-base font-bold"
              >
                <dt>{{ 'compras.total' | transloco }}</dt>
                <dd class="tabular">{{ c.total | cop }}</dd>
              </div>
              <div class="flex justify-between gap-6 pt-2">
                <dt class="text-muted">{{ 'pago.metodo' | transloco }}</dt>
                <dd>
                  {{ 'pago.metodos.' + c.pago.metodo | transloco }}
                  @if (c.pago.referencia) {
                    · {{ c.pago.referencia }}
                  }
                </dd>
              </div>
              @if (c.pago.montoRecibido !== null) {
                <div class="flex justify-between gap-6">
                  <dt class="text-muted">{{ 'pago.recibido' | transloco }}</dt>
                  <dd class="tabular">{{ c.pago.montoRecibido | cop }}</dd>
                </div>
                <div class="flex justify-between gap-6">
                  <dt class="text-muted">{{ 'pago.cambio' | transloco }}</dt>
                  <dd class="tabular">{{ c.pago.cambio | cop }}</dd>
                </div>
              }
              <div class="flex justify-between gap-6">
                <dt class="text-muted">{{ 'taller.pago.fecha' | transloco }}</dt>
                <dd>{{ c.pago.fecha | fecha: 'fechaHora' }}</dd>
              </div>
            </dl>
          </div>

          <p class="rounded-lg bg-surface-2 px-3 py-2 text-center text-sm font-semibold">
            {{ c.leyenda }}
          </p>
        </article>
      } @else {
        <div class="mx-auto max-w-3xl"><hk-skeleton variante="rectangulo" alto="28rem" /></div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComprobanteOrdenPage {
  private readonly api = inject(OrdenesApiService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly comprobante = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.comprobante(params, erroresManejados()),
  });

  protected imprimir(): void {
    window.print();
  }
}
