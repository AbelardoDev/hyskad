import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';

import { erroresManejados } from '../../core/http/contexto-http';
import { CopPipe, FechaPipe } from '../../core/utils/formato.pipes';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { HkCombobox } from '../../shared/ui/forms/combobox';
import { HkDateInput } from '../../shared/ui/forms/date-input';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { ColumnaTabla, HkCelda, HkTable } from '../../shared/ui/table/table';
import { buscadorProveedores } from '../proveedores/buscador-proveedores';
import {
  CompraResumen,
  ComprasApiService,
  EstadoCompra,
  FiltrosCompras,
} from './compras-api.service';
import { HkEstadoCompra } from './estado-compra';

const TAMANO_PAGINA = 20;
const ESTADOS: readonly EstadoCompra[] = ['REGISTRADA', 'ANULADA'];
const ESPERA_BUSQUEDA_MS = 300;

/** Compras registradas (RF21): filtros por número o factura, proveedor, estado y fechas. */
@Component({
  selector: 'hk-compras-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    CopPipe,
    FechaPipe,
    HkButton,
    HkCard,
    HkCombobox,
    HkDateInput,
    HkEmptyState,
    HkEstadoCompra,
    HkFormField,
    HkInput,
    HkSelect,
    HkPageHeader,
    HkTable,
    HkCelda,
  ],
  template: `
    <hk-page-header
      [titulo]="'compras.titulo' | transloco"
      [subtitulo]="'compras.subtitulo' | transloco"
    >
      <a hk-button icono="plus" hkAccionPrincipal routerLink="/compras/nueva">
        {{ 'compras.nueva' | transloco }}
      </a>
    </hk-page-header>

    <hk-card>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <hk-form-field [etiqueta]="'compras.campos.numero' | transloco">
          <hk-input
            tipo="search"
            icono="search"
            [placeholder]="'compras.buscar_numero' | transloco"
            [valor]="filtros().numero"
            (valorChange)="buscarNumero($event)"
          />
        </hk-form-field>
        <hk-form-field class="lg:col-span-2" [etiqueta]="'compras.campos.proveedor' | transloco">
          <hk-combobox
            [opciones]="proveedores.opciones()"
            [cargando]="proveedores.cargando()"
            [filtrarLocal]="false"
            [placeholder]="'compras.todos_proveedores' | transloco"
            [valor]="filtros().proveedorId?.toString() ?? null"
            (valorChange)="filtrar({ proveedorId: $event ? +$event : null })"
            (busqueda)="proveedores.buscar($event)"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'comun.estado.titulo' | transloco">
          <hk-select
            [opciones]="opcionesEstado()"
            [placeholder]="'comun.filtros.todos_estados' | transloco"
            [valor]="filtros().estado"
            (valorChange)="filtrar({ estado: aEstado($event) })"
          />
        </hk-form-field>
        <div class="grid grid-cols-2 gap-3">
          <hk-form-field [etiqueta]="'inventario.movimientos.desde' | transloco">
            <hk-date-input
              [valor]="filtros().desde"
              (valorChange)="filtrar({ desde: $event || null })"
            />
          </hk-form-field>
          <hk-form-field [etiqueta]="'inventario.movimientos.hasta' | transloco">
            <hk-date-input
              [valor]="filtros().hasta"
              (valorChange)="filtrar({ hasta: $event || null })"
            />
          </hk-form-field>
        </div>
      </div>

      <div class="mt-5">
        @if (compras.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'compras.error_titulo' | transloco"
            [texto]="'comun.error_texto' | transloco"
          >
            <button hk-button variante="secondary" icono="rotate-ccw" (click)="compras.reload()">
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else {
          <hk-table
            [columnas]="columnas()"
            [filas]="compras.value()?.content ?? []"
            [cargando]="compras.isLoading()"
            [etiqueta]="'compras.titulo' | transloco"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="compras.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event }, false)"
            filasClicables
            (filaClic)="verDetalle($event)"
            vacioIcono="truck"
            [vacioTitulo]="'compras.vacio_titulo' | transloco"
            [vacioTexto]="'compras.vacio_texto' | transloco"
          >
            <ng-template hkCelda="numero" let-c>
              <p class="font-medium text-fg">{{ c.numero }}</p>
              <p class="text-xs text-muted">
                {{ 'compras.campos.factura_corta' | transloco }} {{ c.numeroFacturaProveedor }}
              </p>
            </ng-template>
            <ng-template hkCelda="proveedor" let-c>{{ c.proveedor.razonSocial }}</ng-template>
            <ng-template hkCelda="fecha" let-c>
              <span class="whitespace-nowrap">{{ c.fecha | fecha }}</span>
            </ng-template>
            <ng-template hkCelda="total" let-c>
              <span class="font-semibold tabular">{{ c.total | cop }}</span>
            </ng-template>
            <ng-template hkCelda="estado" let-c>
              <hk-estado-compra [estado]="c.estado" />
            </ng-template>
          </hk-table>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComprasPage {
  private readonly api = inject(ComprasApiService);
  private readonly router = inject(Router);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  protected readonly proveedores = buscadorProveedores({ soloActivos: false });
  protected readonly filtros = signal<FiltrosCompras>({
    proveedorId: null,
    desde: null,
    hasta: null,
    estado: null,
    numero: '',
    page: 0,
    size: TAMANO_PAGINA,
  });
  protected readonly compras = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.listar(params, erroresManejados()),
  });

  private readonly textos = translateSignal([
    'compras.campos.numero',
    'compras.campos.proveedor',
    'compras.campos.fecha',
    'compras.total',
    'comun.estado.titulo',
  ]);
  private readonly textosEstado = translateSignal(ESTADOS.map((e) => `compras.estados.${e}`));
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [numero, proveedor, fecha, total, estado] = this.textos();
    return [
      { clave: 'numero', etiqueta: numero, principal: true },
      { clave: 'proveedor', etiqueta: proveedor },
      { clave: 'fecha', etiqueta: fecha, ocultarEnMovil: true },
      { clave: 'total', etiqueta: total, numerica: true },
      { clave: 'estado', etiqueta: estado },
    ];
  });
  protected readonly opcionesEstado = computed<OpcionSelect[]>(() =>
    ESTADOS.map((valor, i) => ({ valor, etiqueta: this.textosEstado()[i] })),
  );

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected aEstado(valor: string | null): EstadoCompra | null {
    return ESTADOS.find((e) => e === valor) ?? null;
  }

  protected filtrar(cambio: Partial<FiltrosCompras>, reiniciarPagina = true): void {
    this.filtros.update((f) => ({ ...f, ...(reiniciarPagina ? { page: 0 } : {}), ...cambio }));
  }

  protected buscarNumero(texto: string | null): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(
      () => this.filtrar({ numero: (texto ?? '').trim() }),
      ESPERA_BUSQUEDA_MS,
    );
  }

  protected verDetalle(compra: CompraResumen): void {
    void this.router.navigate(['/compras', compra.id]);
  }
}
