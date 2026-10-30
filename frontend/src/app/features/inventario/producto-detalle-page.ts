import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { AuthService } from '../../core/auth/auth.service';
import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { ContadoresService } from '../../core/layout/contadores.service';
import { CantidadPipe, CopPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { ConfirmacionService } from '../../shared/ui/dialog/confirm-dialog';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPagination } from '../../shared/ui/pagination/pagination';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { HkTabs, Pestana } from '../../shared/ui/tabs/tabs';
import { ToastService } from '../../shared/ui/toast/toast';
import { AjusteDrawer, DatosAjuste } from './ajuste-drawer';
import { InventarioApiService, Movimiento, Producto } from './inventario-api.service';
import { HkLineaMovimientos } from './linea-movimientos';
import { HkEstadoStock, HkNivelStock } from './nivel-stock';
import { DatosFormProducto, ProductoFormDrawer } from './producto-form-drawer';

const MOVIMIENTOS_POR_PAGINA = 15;

/** Ficha de un producto (RF17, RF18): precio, existencias y su kárdex de movimientos. */
@Component({
  selector: 'hk-producto-detalle-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    CantidadPipe,
    CopPipe,
    HkTienePermisoDirective,
    HkButton,
    HkCard,
    HkEmptyState,
    HkEstadoStock,
    HkLineaMovimientos,
    HkNivelStock,
    HkPageHeader,
    HkPagination,
    HkSkeleton,
    HkTabs,
  ],
  template: `
    @if (producto.error()) {
      <hk-empty-state
        class="mt-10"
        icono="package"
        [titulo]="'inventario.detalle.no_encontrado' | transloco"
        [texto]="'inventario.detalle.no_encontrado_texto' | transloco"
      >
        <a hk-button variante="secondary" icono="chevron-left" routerLink="/inventario">
          {{ 'inventario.detalle.volver' | transloco }}
        </a>
      </hk-empty-state>
    } @else if (producto.value(); as p) {
      <hk-page-header [titulo]="p.nombre" [subtitulo]="p.codigo + ' · ' + p.categoria.nombre">
        <button
          *hkTienePermiso="'INVENTARIO_AJUSTAR'"
          hk-button
          variante="secondary"
          icono="sliders-horizontal"
          [disabled]="!p.activo"
          (click)="ajustar(p)"
        >
          {{ 'inventario.ajuste.titulo' | transloco }}
        </button>
        <ng-container *hkTienePermiso="'PRODUCTOS_GESTIONAR'">
          <button hk-button variante="secondary" icono="pencil" (click)="editar(p)">
            {{ 'comun.editar' | transloco }}
          </button>
          <button hk-button variante="secondary" icono="power" (click)="cambiarEstado(p)">
            {{ (p.activo ? 'comun.desactivar' : 'comun.activar') | transloco }}
          </button>
        </ng-container>
      </hk-page-header>

      <hk-tabs [pestanas]="pestanas()" [(activa)]="pestana" [etiqueta]="p.nombre">
        @if (pestana() === 'resumen') {
          <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <hk-card [titulo]="'inventario.detalle.existencias' | transloco">
              <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
                @if (p.activo) {
                  <hk-estado-stock [estado]="p.estadoStock" />
                } @else {
                  <span class="text-sm text-muted">{{ 'comun.estado.inactivo' | transloco }}</span>
                }
                <hk-nivel-stock class="w-40" [producto]="p" />
              </div>
              <dl class="grid grid-cols-2 gap-4 sm:grid-cols-4">
                @for (dato of existencias(p); track dato.clave) {
                  <div class="rounded-xl bg-surface-2 p-3">
                    <dt class="text-xs text-muted">{{ dato.clave | transloco }}</dt>
                    <dd class="mt-1 text-xl font-semibold text-fg tabular">
                      {{ dato.valor | cantidad }}
                    </dd>
                  </div>
                }
              </dl>
            </hk-card>
            <hk-card [titulo]="'inventario.detalle.datos' | transloco">
              <dl class="grid grid-cols-2 gap-4">
                <div>
                  <dt class="text-xs text-muted">{{ 'inventario.campos.precio' | transloco }}</dt>
                  <dd class="mt-0.5 text-lg font-semibold text-fg tabular">
                    {{ p.precioVenta | cop }}
                  </dd>
                </div>
                @if (p.costoPromedio !== undefined) {
                  <div>
                    <dt class="text-xs text-muted">{{ 'inventario.campos.costo' | transloco }}</dt>
                    <dd class="mt-0.5 text-lg font-semibold text-fg tabular">
                      {{ p.costoPromedio | cop }}
                    </dd>
                  </div>
                }
                <div>
                  <dt class="text-xs text-muted">{{ 'inventario.campos.marca' | transloco }}</dt>
                  <dd class="mt-0.5 font-medium text-fg">
                    {{ p.marca ?? ('comun.sin_dato' | transloco) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted">{{ 'inventario.campos.unidad' | transloco }}</dt>
                  <dd class="mt-0.5 font-medium text-fg">
                    {{ 'inventario.unidades.' + p.unidad | transloco }}
                  </dd>
                </div>
                @if (p.descripcion) {
                  <div class="col-span-2">
                    <dt class="text-xs text-muted">
                      {{ 'inventario.campos.descripcion' | transloco }}
                    </dt>
                    <dd class="mt-0.5 text-sm text-fg">{{ p.descripcion }}</dd>
                  </div>
                }
              </dl>
            </hk-card>
          </div>
        } @else {
          <hk-card>
            @if (movimientos.isLoading() && !movimientos.value()) {
              <hk-skeleton [lineas]="6" />
            } @else if (movimientos.error()) {
              <hk-empty-state
                compacto
                icono="circle-alert"
                [titulo]="'inventario.movimientos.error' | transloco"
              >
                <button
                  hk-button
                  variante="secondary"
                  icono="rotate-ccw"
                  (click)="movimientos.reload()"
                >
                  {{ 'comun.reintentar' | transloco }}
                </button>
              </hk-empty-state>
            } @else if ((movimientos.value()?.totalElements ?? 0) === 0) {
              <hk-empty-state
                compacto
                icono="clipboard-list"
                [titulo]="'inventario.movimientos.vacio_titulo' | transloco"
                [texto]="'inventario.movimientos.vacio_producto' | transloco"
              />
            } @else {
              <hk-linea-movimientos [movimientos]="movimientos.value()?.content ?? []" />
              @if ((movimientos.value()?.totalPages ?? 0) > 1) {
                <hk-pagination
                  class="mt-6"
                  [pagina]="paginaMovimientos()"
                  [tamano]="movimientosPorPagina"
                  [total]="movimientos.value()?.totalElements ?? 0"
                  (paginaCambio)="paginaMovimientos.set($event)"
                />
              }
            }
          </hk-card>
        }
      </hk-tabs>
    } @else {
      <div class="space-y-6" aria-busy="true">
        <hk-skeleton ancho="40%" alto="2rem" />
        <hk-skeleton variante="rectangulo" alto="14rem" />
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoDetallePage {
  private readonly api = inject(InventarioApiService);
  private readonly auth = inject(AuthService);
  private readonly dialogos = inject(DialogosService);
  private readonly confirmacion = inject(ConfirmacionService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly contadores = inject(ContadoresService);

  readonly id = input.required({ transform: numberAttribute });

  protected readonly movimientosPorPagina = MOVIMIENTOS_POR_PAGINA;
  protected readonly pestana = signal('resumen');
  protected readonly paginaMovimientos = signal(0);
  private readonly veMovimientos = computed(() =>
    this.auth.tieneAlguno(['PRODUCTOS_GESTIONAR', 'INVENTARIO_AJUSTAR']),
  );

  protected readonly producto = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.api.producto(params, erroresManejados()),
  });
  protected readonly movimientos = rxResource({
    params: () =>
      this.pestana() === 'movimientos'
        ? { productoId: this.id(), pagina: this.paginaMovimientos() }
        : undefined,
    stream: ({ params }) =>
      this.api.movimientos(
        {
          productoId: params.productoId,
          tipo: null,
          desde: null,
          hasta: null,
          page: params.pagina,
          size: MOVIMIENTOS_POR_PAGINA,
        },
        erroresManejados(),
      ),
  });

  private readonly textosPestanas = translateSignal([
    'inventario.detalle.resumen',
    'inventario.movimientos.titulo',
  ]);
  protected readonly pestanas = computed<Pestana[]>(() => {
    const [resumen, movimientos] = this.textosPestanas();
    const lista: Pestana[] = [{ id: 'resumen', etiqueta: resumen, icono: 'package' }];
    if (this.veMovimientos())
      lista.push({ id: 'movimientos', etiqueta: movimientos, icono: 'clipboard-list' });
    return lista;
  });

  protected existencias(p: Producto): { clave: string; valor: number }[] {
    return [
      { clave: 'inventario.campos.stock_actual', valor: p.stockActual },
      { clave: 'inventario.campos.reservado', valor: p.stockReservado },
      { clave: 'inventario.campos.disponible', valor: p.stockDisponible },
      { clave: 'inventario.campos.minimo', valor: p.stockMinimo },
    ];
  }

  protected editar(producto: Producto): void {
    this.dialogos
      .abrirDrawer<ProductoFormDrawer, DatosFormProducto, Producto>(ProductoFormDrawer, {
        datos: { producto },
        tamano: 'lg',
      })
      .closed.subscribe((guardado) => {
        if (!guardado) return;
        this.toast.exito(
          this.transloco.translate('inventario.actualizado', { nombre: guardado.nombre }),
        );
        this.producto.set(guardado);
        this.contadores.recargar();
      });
  }

  protected ajustar(producto: Producto): void {
    this.dialogos
      .abrirDrawer<AjusteDrawer, DatosAjuste, Movimiento>(AjusteDrawer, { datos: { producto } })
      .closed.subscribe((movimiento) => {
        if (!movimiento) return;
        this.toast.exito(
          this.transloco.translate('inventario.ajuste.registrado', { nombre: producto.nombre }),
        );
        this.producto.reload();
        this.movimientos.reload();
        this.contadores.recargar();
      });
  }

  protected async cambiarEstado(producto: Producto): Promise<void> {
    const activo = !producto.activo;
    const prefijo = activo ? 'inventario.confirmar_activar' : 'inventario.confirmar_desactivar';
    const confirmado = await this.confirmacion.pedir({
      titulo: this.transloco.translate(`${prefijo}.titulo`),
      mensaje: this.transloco.translate(`${prefijo}.mensaje`, { nombre: producto.nombre }),
      textoConfirmar: this.transloco.translate(activo ? 'comun.activar' : 'comun.desactivar'),
      peligrosa: !activo,
    });
    if (!confirmado) return;
    this.api.cambiarEstadoProducto(producto.id, activo).subscribe((actualizado) => {
      this.toast.exito(
        this.transloco.translate(activo ? 'inventario.activado' : 'inventario.desactivado', {
          nombre: actualizado.nombre,
        }),
      );
      this.producto.set(actualizado);
      this.contadores.recargar();
    });
  }
}
