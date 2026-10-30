import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { ContadoresService } from '../../core/layout/contadores.service';
import { CopPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { DialogosService } from '../../shared/ui/dialog/dialogos.service';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { FiltroActivo, HkFilterBar } from '../../shared/ui/filter-bar/filter-bar';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { ColumnaTabla, HkCelda, HkTable, OrdenTabla } from '../../shared/ui/table/table';
import { ToastService } from '../../shared/ui/toast/toast';
import { AjusteDrawer, DatosAjuste } from './ajuste-drawer';
import { CategoriasModal } from './categorias-modal';
import {
  FiltrosProductos,
  InventarioApiService,
  Movimiento,
  Producto,
} from './inventario-api.service';
import { HkEstadoStock, HkNivelStock } from './nivel-stock';
import { DatosFormProducto, ProductoFormDrawer } from './producto-form-drawer';

const TAMANO_PAGINA = 20;
/** Filtro combinado de estado: los dos primeros son de existencias, los otros del producto. */
const ESTADOS = ['stock_bajo', 'activos', 'inactivos'] as const;
type EstadoFiltro = (typeof ESTADOS)[number];

/** Productos (RF17, RF18, RF29): búsqueda, filtros por categoría y estado, nivel de stock. */
@Component({
  selector: 'hk-productos-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    CopPipe,
    HkTienePermisoDirective,
    HkButton,
    HkCard,
    HkEmptyState,
    HkEstadoStock,
    HkFilterBar,
    HkNivelStock,
    HkSelect,
    HkPageHeader,
    HkTable,
    HkCelda,
  ],
  template: `
    <hk-page-header
      [titulo]="'inventario.titulo' | transloco"
      [subtitulo]="'inventario.subtitulo' | transloco"
    >
      <a
        *hkTienePermiso="['PRODUCTOS_GESTIONAR', 'INVENTARIO_AJUSTAR']"
        hk-button
        variante="secondary"
        icono="clipboard-list"
        routerLink="/inventario/movimientos"
      >
        {{ 'inventario.movimientos.titulo' | transloco }}
      </a>
      <button
        *hkTienePermiso="'PRODUCTOS_GESTIONAR'"
        hk-button
        variante="secondary"
        icono="tags"
        (click)="abrirCategorias()"
      >
        {{ 'inventario.categorias.titulo' | transloco }}
      </button>
      <button
        *hkTienePermiso="'INVENTARIO_AJUSTAR'"
        hk-button
        variante="secondary"
        icono="sliders-horizontal"
        (click)="ajustar()"
      >
        {{ 'inventario.ajuste.titulo' | transloco }}
      </button>
      <button
        *hkTienePermiso="'PRODUCTOS_GESTIONAR'"
        hk-button
        icono="plus"
        hkAccionPrincipal
        (click)="nuevoProducto()"
      >
        {{ 'inventario.nuevo' | transloco }}
      </button>
    </hk-page-header>

    <hk-card>
      <hk-filter-bar
        [placeholder]="'inventario.buscar' | transloco"
        [busqueda]="filtros().q"
        [filtros]="filtrosActivos()"
        (busquedaCambio)="filtrar({ q: $event })"
        (quitar)="quitarFiltro($event)"
        (limpiar)="filtrar({ categoriaId: null, activo: null, soloStockBajo: false })"
      >
        <hk-select
          class="w-full sm:w-48"
          [opciones]="opcionesCategoria()"
          [placeholder]="'inventario.filtros.todas_categorias' | transloco"
          [etiquetaAccesible]="'inventario.campos.categoria' | transloco"
          [valor]="filtros().categoriaId?.toString() ?? null"
          (valorChange)="filtrar({ categoriaId: $event ? +$event : null })"
        />
        <hk-select
          class="w-full sm:w-44"
          [opciones]="opcionesEstado()"
          [placeholder]="'comun.filtros.todos_estados' | transloco"
          [etiquetaAccesible]="'comun.estado.titulo' | transloco"
          [valor]="estadoFiltro()"
          (valorChange)="filtrarEstado($event)"
        />
      </hk-filter-bar>

      <div class="mt-5">
        @if (productos.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'inventario.error_titulo' | transloco"
            [texto]="'comun.error_texto' | transloco"
          >
            <button hk-button variante="secondary" icono="rotate-ccw" (click)="productos.reload()">
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="productos.value()?.content ?? []"
            [cargando]="productos.isLoading()"
            [etiqueta]="'inventario.titulo' | transloco"
            [orden]="orden()"
            (ordenChange)="ordenar($event)"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="productos.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            filasClicables
            (filaClic)="verDetalle($event)"
            vacioIcono="package"
            [vacioTitulo]="'inventario.vacio_titulo' | transloco"
            [vacioTexto]="'inventario.vacio_texto' | transloco"
          >
            <ng-template hkCelda="nombre" let-p>
              <div class="min-w-0">
                <p class="truncate font-medium text-fg">{{ p.nombre }}</p>
                <p class="truncate font-mono text-xs font-normal text-muted">{{ p.codigo }}</p>
              </div>
            </ng-template>
            <ng-template hkCelda="categoria" let-p>{{ p.categoria.nombre }}</ng-template>
            <ng-template hkCelda="marca" let-p>{{ p.marca ?? '—' }}</ng-template>
            <ng-template hkCelda="precioVenta" let-p>
              <span class="tabular">{{ p.precioVenta | cop }}</span>
            </ng-template>
            <ng-template hkCelda="stockDisponible" let-p>
              <hk-nivel-stock [producto]="p" />
            </ng-template>
            <ng-template hkCelda="estadoStock" let-p>
              @if (p.activo) {
                <hk-estado-stock [estado]="p.estadoStock" />
              } @else {
                <span class="text-xs text-muted">{{ 'comun.estado.inactivo' | transloco }}</span>
              }
            </ng-template>
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductosPage {
  private readonly api = inject(InventarioApiService);
  private readonly router = inject(Router);
  private readonly dialogos = inject(DialogosService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly contadores = inject(ContadoresService);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  protected readonly filtros = signal<FiltrosProductos>({
    q: '',
    categoriaId: null,
    activo: null,
    soloStockBajo: false,
    page: 0,
    size: TAMANO_PAGINA,
    sort: 'nombre,asc',
  });

  protected readonly productos = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.productos(params, erroresManejados()),
  });
  private readonly categorias = rxResource({
    stream: () => this.api.categorias(null, erroresManejados()),
  });

  protected readonly orden = computed<OrdenTabla | null>(() => {
    const [columna, direccion] = (this.filtros().sort ?? '').split(',');
    return columna ? { columna, direccion: direccion === 'desc' ? 'desc' : 'asc' } : null;
  });
  protected readonly estadoFiltro = computed<EstadoFiltro | null>(() => {
    const { soloStockBajo, activo } = this.filtros();
    if (soloStockBajo) return 'stock_bajo';
    return activo === null ? null : activo ? 'activos' : 'inactivos';
  });

  private readonly textos = translateSignal([
    'inventario.campos.producto',
    'inventario.campos.categoria',
    'inventario.campos.marca',
    'inventario.campos.precio',
    'inventario.campos.disponible',
    'inventario.campos.estado_stock',
  ]);
  private readonly textosEstado = translateSignal(ESTADOS.map((e) => `inventario.filtros.${e}`));

  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [producto, categoria, marca, precio, disponible, estado] = this.textos();
    return [
      { clave: 'nombre', etiqueta: producto, ordenable: true, principal: true },
      { clave: 'categoria', etiqueta: categoria, ocultarEnMovil: true },
      { clave: 'marca', etiqueta: marca, ordenable: true, ocultarEnMovil: true },
      { clave: 'precioVenta', etiqueta: precio, ordenable: true, numerica: true },
      { clave: 'stockDisponible', etiqueta: disponible },
      { clave: 'estadoStock', etiqueta: estado },
    ];
  });
  protected readonly opcionesCategoria = computed<OpcionSelect[]>(() =>
    (this.categorias.value() ?? []).map((c) => ({ valor: String(c.id), etiqueta: c.nombre })),
  );
  protected readonly opcionesEstado = computed<OpcionSelect[]>(() =>
    ESTADOS.map((valor, i) => ({ valor, etiqueta: this.textosEstado()[i] })),
  );
  protected readonly filtrosActivos = computed<FiltroActivo[]>(() => {
    const { categoriaId } = this.filtros();
    const activos: FiltroActivo[] = [];
    const categoria = this.categorias.value()?.find((c) => c.id === categoriaId);
    if (categoria) activos.push({ clave: 'categoria', etiqueta: categoria.nombre });
    const estado = this.estadoFiltro();
    if (estado)
      activos.push({ clave: 'estado', etiqueta: this.textosEstado()[ESTADOS.indexOf(estado)] });
    return activos;
  });

  protected filtrar(cambio: Partial<FiltrosProductos>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected filtrarEstado(valor: string | null): void {
    this.filtrar({
      soloStockBajo: valor === 'stock_bajo',
      activo: valor === 'activos' ? true : valor === 'inactivos' ? false : null,
    });
  }

  protected quitarFiltro(clave: string): void {
    if (clave === 'categoria') this.filtrar({ categoriaId: null });
    else this.filtrar({ activo: null, soloStockBajo: false });
  }

  protected ordenar(orden: OrdenTabla | null): void {
    this.filtrar({ sort: orden ? `${orden.columna},${orden.direccion}` : null });
  }

  protected verDetalle(producto: Producto): void {
    void this.router.navigate(['/inventario/productos', producto.id]);
  }

  protected nuevoProducto(): void {
    this.dialogos
      .abrirDrawer<ProductoFormDrawer, DatosFormProducto, Producto>(ProductoFormDrawer, {
        datos: {},
        tamano: 'lg',
      })
      .closed.subscribe((creado) => {
        if (!creado) return;
        this.toast.exito(this.transloco.translate('inventario.creado', { nombre: creado.nombre }));
        this.contadores.recargar();
        void this.router.navigate(['/inventario/productos', creado.id]);
      });
  }

  protected abrirCategorias(): void {
    this.dialogos
      .abrirModal(CategoriasModal, { tamano: 'lg' })
      .closed.subscribe(() => this.categorias.reload());
  }

  protected ajustar(): void {
    this.dialogos
      .abrirDrawer<AjusteDrawer, DatosAjuste, Movimiento>(AjusteDrawer, { datos: {} })
      .closed.subscribe((movimiento) => {
        if (!movimiento) return;
        this.toast.exito(
          this.transloco.translate('inventario.ajuste.registrado', {
            nombre: movimiento.producto.nombre,
          }),
        );
        this.contadores.recargar();
        this.productos.reload();
      });
  }
}
