import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { finalize } from 'rxjs';

import { erroresManejados } from '../../core/http/contexto-http';
import { CantidadPipe, CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkCombobox } from '../../shared/ui/forms/combobox';
import { HkDateInput } from '../../shared/ui/forms/date-input';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { ColumnaTabla, HkCelda, HkTable } from '../../shared/ui/table/table';
import { buscadorProductos } from './buscador-productos';
import {
  ES_ENTRADA,
  FiltrosMovimientos,
  InventarioApiService,
  TipoMovimiento,
  TIPOS_MOVIMIENTO,
} from './inventario-api.service';
import { ESTILO_MOVIMIENTO } from './linea-movimientos';

const TAMANO_PAGINA = 25;
/** Colombia no tiene horario de verano: las fechas del filtro se toman a medianoche de Bogotá. */
const ZONA_BOGOTA = '-05:00';

/** Medianoche de Bogotá del día `aaaa-mm-dd` (más `dias`) en ISO UTC. */
export function inicioDelDia(fecha: string, dias = 0): string {
  const instante = new Date(`${fecha}T00:00:00${ZONA_BOGOTA}`);
  instante.setUTCDate(instante.getUTCDate() + dias);
  return instante.toISOString();
}

/** Movimientos de inventario de todos los productos (RF18) con filtros y exportación CSV. */
@Component({
  selector: 'hk-movimientos-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    CantidadPipe,
    CopPipe,
    FechaPipe,
    HkButton,
    HkCard,
    HkCombobox,
    HkDateInput,
    HkEmptyState,
    HkFormField,
    HkSelect,
    HkPageHeader,
    HkTable,
    HkCelda,
  ],
  template: `
    <hk-page-header
      [titulo]="'inventario.movimientos.titulo' | transloco"
      [subtitulo]="'inventario.movimientos.subtitulo' | transloco"
    >
      <a hk-button variante="secondary" icono="chevron-left" routerLink="/inventario">
        {{ 'inventario.titulo' | transloco }}
      </a>
      <button
        hk-button
        icono="download"
        hkAccionPrincipal
        [cargando]="exportando()"
        (click)="exportar()"
      >
        {{ 'inventario.movimientos.exportar' | transloco }}
      </button>
    </hk-page-header>

    <hk-card>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <hk-form-field [etiqueta]="'inventario.campos.producto' | transloco">
          <hk-combobox
            [opciones]="productos.opciones()"
            [cargando]="productos.cargando()"
            [filtrarLocal]="false"
            [placeholder]="'inventario.movimientos.todos_productos' | transloco"
            [valor]="productoFiltro()"
            (valorChange)="filtrarProducto($event)"
            (busqueda)="productos.buscar($event)"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'inventario.movimientos.tipo' | transloco">
          <hk-select
            [opciones]="opcionesTipo()"
            [placeholder]="'inventario.movimientos.todos_tipos' | transloco"
            [valor]="filtros().tipo"
            (valorChange)="filtrar({ tipo: aTipo($event) })"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'inventario.movimientos.desde' | transloco">
          <hk-date-input
            [valor]="desde()"
            [max]="hasta() ?? undefined"
            (valorChange)="cambiarFechas($event, hasta())"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'inventario.movimientos.hasta' | transloco">
          <hk-date-input
            [valor]="hasta()"
            [min]="desde() ?? undefined"
            (valorChange)="cambiarFechas(desde(), $event)"
          />
        </hk-form-field>
      </div>

      <div class="mt-5">
        @if (movimientos.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'inventario.movimientos.error' | transloco"
            [texto]="'comun.error_texto' | transloco"
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
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="movimientos.value()?.content ?? []"
            [cargando]="movimientos.isLoading()"
            [etiqueta]="'inventario.movimientos.titulo' | transloco"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="movimientos.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            vacioIcono="clipboard-list"
            [vacioTitulo]="'inventario.movimientos.vacio_titulo' | transloco"
            [vacioTexto]="'inventario.movimientos.vacio_texto' | transloco"
          >
            <ng-template hkCelda="fecha" let-m>
              <span class="whitespace-nowrap">{{ m.fecha | fecha: 'fechaHora' }}</span>
            </ng-template>
            <ng-template hkCelda="tipo" let-m>
              <span class="inline-flex items-center gap-2 whitespace-nowrap">
                <span
                  class="inline-flex size-7 items-center justify-center rounded-full"
                  [class]="estilo(m.tipo).clases"
                  aria-hidden="true"
                >
                  <svg [lucideIcon]="estilo(m.tipo).icono" class="size-3.5" />
                </span>
                {{ 'inventario.tipos.' + m.tipo | transloco }}
              </span>
            </ng-template>
            <ng-template hkCelda="producto" let-m>
              <a
                class="rounded font-medium text-fg hk-foco hover:text-primary hover:underline"
                [routerLink]="['/inventario/productos', m.producto.id]"
                >{{ m.producto.nombre }}</a
              >
              <p class="font-mono text-xs text-muted">{{ m.producto.codigo }}</p>
            </ng-template>
            <ng-template hkCelda="cantidad" let-m>
              <span
                class="font-semibold tabular"
                [class]="esEntrada(m.tipo) ? 'text-success-ink' : 'text-danger-ink'"
                >{{ esEntrada(m.tipo) ? '+' : '−' }}{{ m.cantidad | cantidad }}</span
              >
            </ng-template>
            <ng-template hkCelda="costoUnitario" let-m>
              <span class="tabular">{{ m.costoUnitario | cop }}</span>
            </ng-template>
            <ng-template hkCelda="stockResultante" let-m>
              <span class="tabular">{{ m.stockResultante | cantidad }}</span>
            </ng-template>
            <ng-template hkCelda="detalle" let-m>
              <p class="text-sm text-fg">{{ m.motivo ?? m.referencia?.numero ?? '—' }}</p>
              @if (m.usuario) {
                <p class="text-xs text-muted">{{ m.usuario.nombre }}</p>
              }
            </ng-template>
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovimientosPage {
  private readonly api = inject(InventarioApiService);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  protected readonly productos = buscadorProductos({ soloActivos: false });
  protected readonly exportando = signal(false);
  protected readonly productoFiltro = signal<string | null>(null);
  protected readonly desde = signal<string | null>(null);
  protected readonly hasta = signal<string | null>(null);
  protected readonly filtros = signal<FiltrosMovimientos>({
    productoId: null,
    tipo: null,
    desde: null,
    hasta: null,
    page: 0,
    size: TAMANO_PAGINA,
  });

  protected readonly movimientos = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.movimientos(params, erroresManejados()),
  });

  private readonly textos = translateSignal([
    'inventario.movimientos.fecha',
    'inventario.movimientos.tipo',
    'inventario.campos.producto',
    'inventario.movimientos.cantidad',
    'inventario.movimientos.costo',
    'inventario.movimientos.stock_resultante',
    'inventario.movimientos.motivo',
  ]);
  private readonly textosTipo = translateSignal(
    TIPOS_MOVIMIENTO.map((t) => `inventario.tipos.${t}`),
  );

  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [fecha, tipo, producto, cantidad, costo, stock, motivo] = this.textos();
    return [
      { clave: 'producto', etiqueta: producto, principal: true },
      { clave: 'fecha', etiqueta: fecha },
      { clave: 'tipo', etiqueta: tipo },
      { clave: 'cantidad', etiqueta: cantidad, numerica: true },
      { clave: 'costoUnitario', etiqueta: costo, numerica: true, ocultarEnMovil: true },
      { clave: 'stockResultante', etiqueta: stock, numerica: true, ocultarEnMovil: true },
      { clave: 'detalle', etiqueta: motivo, ocultarEnMovil: true },
    ];
  });
  protected readonly opcionesTipo = computed<OpcionSelect[]>(() =>
    TIPOS_MOVIMIENTO.map((valor, i) => ({ valor, etiqueta: this.textosTipo()[i] })),
  );

  protected estilo(tipo: TipoMovimiento): { icono: string; clases: string } {
    return ESTILO_MOVIMIENTO[tipo];
  }

  protected esEntrada(tipo: TipoMovimiento): boolean {
    return ES_ENTRADA[tipo];
  }

  protected aTipo(valor: string | null): TipoMovimiento | null {
    return TIPOS_MOVIMIENTO.find((t) => t === valor) ?? null;
  }

  protected filtrar(cambio: Partial<FiltrosMovimientos>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected filtrarProducto(id: string | null): void {
    this.productoFiltro.set(id);
    this.filtrar({ productoId: id ? Number(id) : null });
  }

  /** `hasta` incluye todo ese día: se envía la medianoche del día siguiente (exclusiva). */
  protected cambiarFechas(desde: string | null, hasta: string | null): void {
    this.desde.set(desde || null);
    this.hasta.set(hasta || null);
    this.filtrar({
      desde: desde ? inicioDelDia(desde) : null,
      hasta: hasta ? inicioDelDia(hasta, 1) : null,
    });
  }

  protected exportar(): void {
    if (this.exportando()) return;
    this.exportando.set(true);
    this.api
      .exportarMovimientos(this.filtros())
      .pipe(finalize(() => this.exportando.set(false)))
      .subscribe((csv) => {
        const url = URL.createObjectURL(csv);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'movimientos-inventario.csv';
        enlace.click();
        URL.revokeObjectURL(url);
      });
  }
}
