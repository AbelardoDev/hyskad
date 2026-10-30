import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  linkedSignal,
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
import { VentasApiService } from './ventas-api.service';

export type FormatoComprobante = 'carta' | 'tirilla';

/**
 * Comprobante de venta (RF27, RN-06) fuera del layout de la app: hoja carta o tirilla de 80 mm,
 * con logo, datos del taller, detalle, totales y la leyenda de documento interno. Se imprime o se
 * guarda como PDF con el diálogo del navegador. El papel es siempre claro, también en tema oscuro.
 */
@Component({
  selector: 'hk-comprobante-page',
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
    @page {
      size: letter;
      margin: 14mm;
    }
    @page tirilla {
      size: 80mm auto;
      margin: 3mm;
    }
    /* Papel: tokens del tema claro aunque la app esté en oscuro (y siempre al imprimir). */
    .hk-recibo {
      --surface: #ffffff;
      --surface-2: #f0f4fb;
      --border: #e2e8f3;
      --fg: #0f1d3f;
      --muted: #4a5878;
      --danger-ink: #b91c1c;
      background: var(--surface);
      color: var(--fg);
    }
    .hk-recibo.tirilla {
      page: tirilla;
      width: 80mm;
      font-size: 11px;
    }
    @media print {
      body {
        background: #ffffff;
      }
      .hk-no-imprimir {
        display: none !important;
      }
      .hk-comprobante {
        padding: 0 !important;
      }
      .hk-recibo {
        box-shadow: none !important;
        border: 0 !important;
        margin: 0 !important;
        max-width: none !important;
      }
    }
  `,
  template: `
    <div class="hk-comprobante min-h-dvh bg-bg px-4 py-6">
      <div
        class="hk-no-imprimir mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-between gap-3"
      >
        <a hk-button variante="secondary" icono="chevron-left" [routerLink]="['/ventas', id()]">
          {{ 'ventas.comprobante_volver' | transloco }}
        </a>
        <div class="flex flex-wrap items-center gap-2">
          <div
            class="inline-flex rounded-xl border border-border bg-surface p-1"
            role="group"
            [attr.aria-label]="'ventas.formato' | transloco"
          >
            @for (f of formatos; track f) {
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-sm font-medium hk-foco"
                [class]="
                  formatoElegido() === f
                    ? 'bg-primary text-primary-fg'
                    : 'text-fg hover:bg-surface-2'
                "
                [attr.aria-pressed]="formatoElegido() === f"
                (click)="formatoElegido.set(f)"
              >
                {{ 'ventas.formatos.' + f | transloco }}
              </button>
            }
          </div>
          <button hk-button icono="printer" (click)="imprimir()">
            {{ 'ventas.imprimir' | transloco }}
          </button>
        </div>
      </div>

      @if (comprobante.error()) {
        <hk-empty-state
          icono="circle-alert"
          [titulo]="'ventas.detalle.no_encontrada' | transloco"
        />
      } @else if (comprobante.value(); as c) {
        <article
          class="hk-recibo relative mx-auto rounded-2xl border border-border p-8 shadow-card"
          [class.max-w-3xl]="formatoElegido() === 'carta'"
          [class.tirilla]="formatoElegido() === 'tirilla'"
          [class.p-4]="formatoElegido() === 'tirilla'"
          [attr.aria-label]="'ventas.comprobante_de' | transloco: { numero: c.venta.numero }"
        >
          @if (c.venta.estado === 'ANULADA') {
            <p
              class="mb-4 rounded-lg border-2 border-danger-ink px-3 py-2 text-center font-display text-lg font-bold tracking-widest text-danger-ink uppercase"
            >
              {{ 'ventas.estados.ANULADA' | transloco }}
            </p>
          }
          <header
            class="flex flex-wrap justify-between gap-4 border-b border-border pb-5"
            [class.items-start]="formatoElegido() === 'carta'"
            [class.flex-col]="formatoElegido() === 'tirilla'"
            [class.items-center]="formatoElegido() === 'tirilla'"
          >
            <div [class.text-center]="formatoElegido() === 'tirilla'">
              <img
                src="brand/logo.svg"
                alt="HYSKAD"
                class="h-8"
                [class.mx-auto]="formatoElegido() === 'tirilla'"
              />
              <p class="mt-3 font-semibold">{{ c.taller.nombre }}</p>
              <p class="text-sm text-muted">NIT {{ c.taller.nit }}</p>
              <p class="text-sm text-muted">{{ c.taller.direccion }}</p>
              <p class="text-sm text-muted">{{ c.taller.telefono }}</p>
            </div>
            <div
              [class.text-right]="formatoElegido() === 'carta'"
              [class.text-center]="formatoElegido() === 'tirilla'"
            >
              <p class="text-xs font-semibold tracking-wider text-muted uppercase">
                {{ 'ventas.comprobante' | transloco }}
              </p>
              <p class="font-display text-2xl font-bold">{{ c.venta.numero }}</p>
              <p class="text-sm text-muted">{{ c.venta.fecha | fecha: 'fechaHora' }}</p>
            </div>
          </header>

          <section
            class="grid gap-4 border-b border-border py-4 text-sm"
            [class.sm:grid-cols-2]="formatoElegido() === 'carta'"
          >
            <div>
              <p class="text-xs text-muted">{{ 'ventas.campos.cliente' | transloco }}</p>
              @if (c.venta.cliente; as cl) {
                <p class="font-medium">{{ cl.nombreCompleto }}</p>
                <p class="text-muted">
                  {{ cl.tipoDocumento }} {{ cl.numeroDocumento }} · {{ cl.telefono }}
                </p>
              } @else {
                <p class="font-medium">{{ 'ventas.consumidor_final' | transloco }}</p>
              }
            </div>
            <div>
              <p class="text-xs text-muted">{{ 'ventas.campos.vendedor' | transloco }}</p>
              <p class="font-medium">{{ c.venta.vendedor?.nombre ?? '—' }}</p>
            </div>
          </section>

          <table class="w-full border-b border-border text-sm">
            <thead>
              <tr class="text-left text-xs text-muted">
                <th scope="col" class="py-2 font-medium">
                  {{ 'compras.campos.producto_columna' | transloco }}
                </th>
                <th scope="col" class="py-2 pl-3 text-right font-medium">
                  {{ 'compras.campos.cantidad' | transloco }}
                </th>
                @if (formatoElegido() === 'carta') {
                  <th scope="col" class="py-2 pl-3 text-right font-medium">
                    {{ 'ventas.campos.precio' | transloco }}
                  </th>
                }
                <th scope="col" class="py-2 pl-3 text-right font-medium">
                  {{ 'compras.subtotal' | transloco }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (i of c.venta.items; track i.id) {
                <tr class="border-t border-border align-top">
                  <td class="py-2 pr-2">
                    {{ i.nombre }}
                    @if (formatoElegido() === 'tirilla') {
                      <span class="block text-xs text-muted">{{ i.precioUnitario | cop }}</span>
                    }
                  </td>
                  <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                    {{ i.cantidad | cantidad }}
                  </td>
                  @if (formatoElegido() === 'carta') {
                    <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                      {{ i.precioUnitario | cop }}
                    </td>
                  }
                  <td class="py-2 pl-3 text-right whitespace-nowrap tabular">
                    {{ i.subtotal | cop }}
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <dl
            class="ml-auto space-y-1 py-4 text-sm"
            [class.max-w-xs]="formatoElegido() === 'carta'"
          >
            <div class="flex justify-between gap-6">
              <dt class="text-muted">{{ 'compras.subtotal' | transloco }}</dt>
              <dd class="tabular">{{ c.venta.subtotal | cop }}</dd>
            </div>
            @if (c.venta.descuento > 0) {
              <div class="flex justify-between gap-6">
                <dt class="text-muted">{{ 'ventas.campos.descuento' | transloco }}</dt>
                <dd class="tabular">−{{ c.venta.descuento | cop }}</dd>
              </div>
            }
            <div class="flex justify-between gap-6">
              <dt class="text-muted">
                {{ 'compras.iva' | transloco: { porcentaje: c.venta.ivaPorcentaje } }}
              </dt>
              <dd class="tabular">{{ c.venta.impuesto | cop }}</dd>
            </div>
            <div class="flex justify-between gap-6 border-t border-border pt-2 text-base font-bold">
              <dt>{{ 'compras.total' | transloco }}</dt>
              <dd class="tabular">{{ c.venta.total | cop }}</dd>
            </div>
            <div class="flex justify-between gap-6 pt-2">
              <dt class="text-muted">{{ 'ventas.campos.metodo' | transloco }}</dt>
              <dd>
                {{ 'ventas.metodos.' + c.venta.metodoPago | transloco }}
                @if (c.venta.referenciaPago) {
                  · {{ c.venta.referenciaPago }}
                }
              </dd>
            </div>
            @if (c.venta.montoRecibido !== null) {
              <div class="flex justify-between gap-6">
                <dt class="text-muted">{{ 'ventas.campos.recibido' | transloco }}</dt>
                <dd class="tabular">{{ c.venta.montoRecibido | cop }}</dd>
              </div>
              <div class="flex justify-between gap-6">
                <dt class="text-muted">{{ 'ventas.pos.cambio' | transloco }}</dt>
                <dd class="tabular">{{ c.venta.cambio | cop }}</dd>
              </div>
            }
          </dl>

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
export class ComprobantePage {
  private readonly api = inject(VentasApiService);

  readonly id = input.required({ transform: numberAttribute });
  /** `?formato=tirilla` abre directamente el formato de 80 mm. */
  readonly formato = input<FormatoComprobante>();

  protected readonly formatos: readonly FormatoComprobante[] = ['carta', 'tirilla'];
  protected readonly formatoElegido = linkedSignal<FormatoComprobante>(() =>
    this.formato() === 'tirilla' ? 'tirilla' : 'carta',
  );
  protected readonly comprobante = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.comprobante(params, erroresManejados()),
  });

  protected imprimir(): void {
    window.print();
  }
}
