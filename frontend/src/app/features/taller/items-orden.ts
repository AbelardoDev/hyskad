import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize, Observable } from 'rxjs';

import { CantidadPipe, CopPipe } from '../../core/utils/formato.pipes';
import { aCantidad } from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { HkIconButton } from '../../shared/ui/button/icon-button';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkInput } from '../../shared/ui/forms/input';
import { HkMoneyInput } from '../../shared/ui/forms/money-input';
import { AgregarRepuestoModal } from './agregar-repuesto-modal';
import { AgregarServicioModal } from './agregar-servicio-modal';
import { Orden, OrdenesApiService, RepuestoOrden, ServicioOrden } from './ordenes-api.service';

/**
 * Servicios y repuestos de la orden (RF15, RF19, RF24). En diagnóstico y con permiso
 * (`accionesPermitidas.editarItems`) el precio de cada servicio y la cantidad de cada repuesto se
 * editan en la tabla; fuera de diagnóstico se ven de solo lectura con el motivo (RN-28). Los
 * totales del panel los calcula el backend.
 */
@Component({
  selector: 'hk-items-orden',
  imports: [
    TranslocoPipe,
    LucideDynamicIcon,
    CantidadPipe,
    CopPipe,
    HkButton,
    HkIconButton,
    HkInput,
    HkMoneyInput,
  ],
  template: `
    @let o = orden();
    @if (!editable()) {
      <p
        class="mb-5 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted"
        role="note"
      >
        <svg lucideIcon="info" class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {{ motivoSoloLectura() | transloco }}
      </p>
    }
    <div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div class="min-w-0 space-y-8">
        <section aria-labelledby="titulo-servicios">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 id="titulo-servicios" class="font-display text-base font-semibold text-fg">
              {{ 'taller.items.servicios' | transloco }}
            </h3>
            @if (editable()) {
              <button
                hk-button
                variante="secondary"
                icono="plus"
                class="max-sm:h-12 max-sm:w-full"
                (click)="agregarServicio()"
              >
                {{ 'taller.items.agregar_servicio' | transloco }}
              </button>
            }
          </div>
          @if (o.servicios.length === 0) {
            <p
              class="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted"
            >
              {{ 'taller.items.sin_servicios' | transloco }}
            </p>
          } @else {
            <ul class="divide-y divide-border rounded-lg border border-border">
              @for (s of o.servicios; track s.id) {
                <li class="flex flex-wrap items-center gap-3 px-3 py-3">
                  <div class="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                    <p class="font-medium text-fg">{{ s.descripcion }}</p>
                    <p class="text-xs text-muted">
                      {{
                        (s.servicioId ? 'taller.items.de_catalogo' : 'taller.items.mano_obra')
                          | transloco
                      }}
                      @if (s.mecanico) {
                        · {{ s.mecanico.nombre }}
                      }
                    </p>
                  </div>
                  @if (editable()) {
                    <hk-money-input
                      class="w-36 max-sm:ml-auto"
                      [valor]="s.precio"
                      [etiquetaAccesible]="
                        'taller.items.precio_de' | transloco: { item: s.descripcion }
                      "
                      (valorChange)="cambiarPrecio(s, $event)"
                    />
                    <button
                      hk-icon-button
                      icono="trash"
                      variante="danger"
                      [etiqueta]="'taller.items.quitar' | transloco: { item: s.descripcion }"
                      (click)="quitarServicio(s)"
                    ></button>
                  } @else {
                    <span class="font-medium text-fg tabular">{{ s.precio | cop }}</span>
                  }
                </li>
              }
            </ul>
          }
        </section>

        <section aria-labelledby="titulo-repuestos">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 id="titulo-repuestos" class="font-display text-base font-semibold text-fg">
              {{ 'taller.items.repuestos' | transloco }}
            </h3>
            @if (editable()) {
              <button
                hk-button
                variante="secondary"
                icono="plus"
                class="max-sm:h-12 max-sm:w-full"
                (click)="agregarRepuesto()"
              >
                {{ 'taller.items.agregar_repuesto' | transloco }}
              </button>
            }
          </div>
          @if (o.repuestos.length === 0) {
            <p
              class="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted"
            >
              {{ 'taller.items.sin_repuestos' | transloco }}
            </p>
          } @else {
            <ul class="divide-y divide-border rounded-lg border border-border">
              @for (r of o.repuestos; track r.id) {
                <li class="flex flex-wrap items-center gap-3 px-3 py-3">
                  <div class="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                    <p class="font-medium text-fg">{{ r.nombre }}</p>
                    <p class="text-xs text-muted">
                      {{ r.codigo }} · {{ r.precioUnitario | cop }} ·
                      {{ 'taller.items.disponible' | transloco }} {{ r.stockDisponible | cantidad }}
                    </p>
                  </div>
                  @if (editable()) {
                    <hk-input
                      class="w-24"
                      modoTeclado="decimal"
                      [maxCaracteres]="13"
                      [valor]="r.cantidad.toString()"
                      [etiquetaAccesible]="
                        'taller.items.cantidad_de' | transloco: { item: r.nombre }
                      "
                      (change)="cambiarCantidad(r, $event)"
                    />
                  } @else {
                    <span class="text-sm text-muted tabular">× {{ r.cantidad | cantidad }}</span>
                  }
                  <span class="ml-auto w-28 text-right font-medium text-fg tabular sm:ml-0">{{
                    r.subtotal | cop
                  }}</span>
                  @if (editable()) {
                    <button
                      hk-icon-button
                      icono="trash"
                      variante="danger"
                      [etiqueta]="'taller.items.quitar' | transloco: { item: r.nombre }"
                      (click)="quitarRepuesto(r)"
                    ></button>
                  }
                </li>
              }
            </ul>
          }
        </section>
      </div>

      <aside
        class="h-fit rounded-xl border border-border bg-surface-2 p-4 lg:sticky lg:top-20"
        [attr.aria-label]="'taller.items.totales' | transloco"
        aria-live="polite"
        [attr.aria-busy]="guardando()"
      >
        <dl class="space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-muted">{{ 'compras.subtotal' | transloco }}</dt>
            <dd class="font-medium text-fg tabular">{{ o.subtotal | cop }}</dd>
          </div>
          @if (o.descuento > 0) {
            <div class="flex justify-between">
              <dt class="text-muted">{{ 'ventas.campos.descuento' | transloco }}</dt>
              <dd class="font-medium text-fg tabular">−{{ o.descuento | cop }}</dd>
            </div>
          }
          <div class="flex justify-between">
            <dt class="text-muted">
              {{ 'compras.iva' | transloco: { porcentaje: o.ivaPorcentaje } }}
            </dt>
            <dd class="font-medium text-fg tabular">{{ o.impuesto | cop }}</dd>
          </div>
          <div class="flex justify-between border-t border-border pt-3 text-base">
            <dt class="font-semibold text-fg">{{ 'compras.total' | transloco }}</dt>
            <dd class="font-display text-xl font-bold text-fg tabular">{{ o.total | cop }}</dd>
          </div>
        </dl>
      </aside>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkItemsOrden {
  private readonly api = inject(OrdenesApiService);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly transloco = inject(TranslocoService);

  readonly orden = input.required<Orden>();
  readonly cambio = output<Orden>();
  /** Algo falló (p. ej. otro usuario cambió la orden): hay que releerla. */
  readonly recargar = output<void>();
  protected readonly guardando = signal(false);

  protected readonly editable = computed(() => this.orden().accionesPermitidas.editarItems);
  /** Por qué no se puede editar: el estado (RN-28) o la falta de permiso. */
  protected readonly motivoSoloLectura = computed(() =>
    this.orden().estado === 'EN_DIAGNOSTICO'
      ? 'taller.items.solo_lectura_permiso'
      : 'taller.items.solo_lectura_estado',
  );

  protected agregarServicio(): void {
    this.abrir(AgregarServicioModal);
  }

  protected agregarRepuesto(): void {
    this.abrir(AgregarRepuestoModal);
  }

  protected cambiarPrecio(s: ServicioOrden, precio: number | null): void {
    if (precio === null || precio <= 0 || precio === s.precio) return;
    this.enviar(
      this.api.actualizarServicio(this.orden(), s.id, {
        servicioId: s.servicioId,
        descripcion: s.descripcion,
        precio,
        tiempoMin: s.tiempoMin,
        mecanicoId: s.mecanico?.id ?? null,
      }),
    );
  }

  protected cambiarCantidad(r: RepuestoOrden, evento: Event): void {
    const cantidad = aCantidad((evento.target as HTMLInputElement).value);
    if (cantidad === null || cantidad <= 0 || cantidad === r.cantidad) return;
    this.enviar(this.api.cambiarCantidadRepuesto(this.orden(), r.id, cantidad));
  }

  protected async quitarServicio(s: ServicioOrden): Promise<void> {
    if (await this.confirmarQuitar(s.descripcion))
      this.enviar(this.api.quitarServicio(this.orden(), s.id));
  }

  protected async quitarRepuesto(r: RepuestoOrden): Promise<void> {
    if (await this.confirmarQuitar(r.nombre))
      this.enviar(this.api.quitarRepuesto(this.orden(), r.id));
  }

  private async confirmarQuitar(item: string): Promise<boolean> {
    const resultado = await this.confirmacion.pedir({
      titulo: this.transloco.translate('taller.items.confirmar_quitar.titulo'),
      mensaje: this.transloco.translate('taller.items.confirmar_quitar.mensaje', { item }),
      textoConfirmar: this.transloco.translate('taller.items.quitar_corto'),
      peligrosa: true,
    });
    return resultado !== null;
  }

  private abrir(componente: typeof AgregarServicioModal | typeof AgregarRepuestoModal): void {
    this.dialogos
      .abrirModal<unknown, Orden, Orden>(componente, {
        datos: this.orden(),
        tamano: 'lg',
        hojaEnMovil: true,
      })
      .closed.subscribe((orden) => {
        if (orden) this.cambio.emit(orden);
      });
  }

  /** Cada cambio devuelve la orden con los totales recalculados; si falla, se recarga. */
  private enviar(peticion: Observable<Orden>): void {
    this.guardando.set(true);
    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (orden) => this.cambio.emit(orden),
      error: () => this.recargar.emit(),
    });
  }
}
