import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { HkTienePermisoDirective } from '../../core/auth/tiene-permiso.directive';
import { erroresManejados } from '../../core/http/contexto-http';
import { FechaPipe, TiempoRelativoPipe } from '../../core/utils/formato.pipes';
import {
  ESTILO_ESTADO_ORDEN,
  EstadoOrden,
  HkStatusBadge,
} from '../../shared/ui/badge/status-badge';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { FiltroActivo, HkFilterBar } from '../../shared/ui/filter-bar/filter-bar';
import { HkDateInput } from '../../shared/ui/forms/date-input';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ColumnaTabla, HkCelda, HkTable, OrdenTabla } from '../../shared/ui/table/table';
import { HkMecanicosAvatares } from './orden-ui';
import {
  ESTADOS_ORDEN,
  FiltrosOrdenes,
  OrdenesApiService,
  OrdenResumen,
} from './ordenes-api.service';

const TAMANO_PAGINA = 20;
/** El kanban trae una sola página grande (el máximo del backend) y la reparte por estado. */
const TAMANO_KANBAN = 100;
const ORDEN_POR_DEFECTO = 'fechaIngreso,desc';

type Vista = 'lista' | 'kanban';

function esEstado(valor: string): valor is EstadoOrden {
  return (ESTADOS_ORDEN as readonly string[]).includes(valor);
}

function aNumero(valor: string | null): number | null {
  const numero = valor === null ? NaN : Number(valor);
  return Number.isInteger(numero) && numero >= 0 ? numero : null;
}

/**
 * Tablero de órdenes (RF29): lista (tabla) o kanban por estado con contadores. Los filtros viven
 * en la URL para compartirlos y volver con el botón Atrás. Quien solo ve sus órdenes asignadas
 * (mecánico) recibe del backend únicamente las suyas.
 */
@Component({
  selector: 'hk-ordenes-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    LucideDynamicIcon,
    FechaPipe,
    TiempoRelativoPipe,
    HkTienePermisoDirective,
    HkButton,
    HkCard,
    HkDateInput,
    HkEmptyState,
    HkFilterBar,
    HkFormField,
    HkMecanicosAvatares,
    HkPageHeader,
    HkPlaca,
    HkSelect,
    HkSkeleton,
    HkStatusBadge,
    HkTable,
    HkCelda,
  ],
  template: `
    <hk-page-header
      [titulo]="'taller.tablero.titulo' | transloco"
      [subtitulo]="'taller.tablero.subtitulo' | transloco"
    >
      <a
        *hkTienePermiso="'ORDENES_VER_ASIGNADAS'"
        hk-button
        variante="secondary"
        icono="user"
        routerLink="/ordenes/mias"
      >
        {{ 'taller.mias.titulo' | transloco }}
      </a>
      <a
        *hkTienePermiso="'ORDENES_CREAR'"
        hk-button
        icono="plus"
        hkAccionPrincipal
        routerLink="/ordenes/nueva"
      >
        {{ 'taller.recepcion.recibir' | transloco }}
      </a>
    </hk-page-header>

    <hk-card>
      <hk-filter-bar
        [placeholder]="'taller.tablero.buscar' | transloco"
        [busqueda]="filtros().q"
        [filtros]="filtrosActivos()"
        (busquedaCambio)="filtrar({ q: $event || null })"
        (quitar)="quitarFiltro($event)"
        (limpiar)="filtrar({ estado: null, mecanico: null, desde: null, hasta: null })"
      >
        <div
          class="inline-flex rounded-lg border border-border-strong p-0.5"
          role="group"
          [attr.aria-label]="'taller.tablero.vista' | transloco"
        >
          @for (opcion of vistas; track opcion.id) {
            <button
              type="button"
              class="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium hk-foco transition-colors"
              [class]="
                vista() === opcion.id
                  ? 'bg-primary-soft text-primary-ink'
                  : 'text-muted hover:text-fg'
              "
              [attr.aria-pressed]="vista() === opcion.id"
              (click)="filtrar({ vista: opcion.id === 'kanban' ? 'kanban' : null })"
            >
              <svg [lucideIcon]="opcion.icono" class="size-4" aria-hidden="true" />
              {{ 'taller.tablero.' + opcion.id | transloco }}
            </button>
          }
        </div>
      </hk-filter-bar>

      <div class="mt-3 grid gap-3 sm:grid-cols-3">
        @if (opcionesMecanico().length > 0) {
          <hk-form-field [etiqueta]="'taller.campos.mecanico' | transloco">
            <hk-select
              [opciones]="opcionesMecanico()"
              [placeholder]="'taller.tablero.todos_mecanicos' | transloco"
              [valor]="filtros().mecanicoId?.toString() ?? null"
              (valorChange)="filtrar({ mecanico: $event })"
            />
          </hk-form-field>
        }
        <hk-form-field [etiqueta]="'taller.tablero.desde' | transloco">
          <hk-date-input
            [valor]="filtros().desde"
            (valorChange)="filtrar({ desde: $event || null })"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'taller.tablero.hasta' | transloco">
          <hk-date-input
            [valor]="filtros().hasta"
            (valorChange)="filtrar({ hasta: $event || null })"
          />
        </hk-form-field>
      </div>

      <div
        class="mt-3 flex flex-wrap gap-2"
        role="group"
        [attr.aria-label]="'taller.tablero.filtrar_estado' | transloco"
      >
        @for (estado of estados; track estado) {
          <button
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hk-foco transition-colors"
            [class]="
              filtros().estados.includes(estado)
                ? 'border-primary bg-primary-soft text-primary-ink'
                : 'border-border-strong text-muted hover:text-fg'
            "
            [attr.aria-pressed]="filtros().estados.includes(estado)"
            (click)="alternarEstado(estado)"
          >
            <svg [lucideIcon]="iconoEstado(estado)" class="size-3.5" aria-hidden="true" />
            {{ 'estados.orden.' + estado | transloco }}
            <span class="tabular">{{ resumen.value()?.[estado] ?? '' }}</span>
          </button>
        }
      </div>

      <div class="mt-5">
        @if (ordenes.error()) {
          <hk-empty-state
            icono="circle-alert"
            [titulo]="'taller.tablero.error_titulo' | transloco"
            [texto]="'comun.error_texto' | transloco"
          >
            <button hk-button variante="secondary" icono="rotate-ccw" (click)="ordenes.reload()">
              {{ 'comun.reintentar' | transloco }}
            </button>
          </hk-empty-state>
        } @else if (vista() === 'lista') {
          <hk-table
            [columnas]="columnas()"
            [filas]="ordenes.value()?.content ?? []"
            [cargando]="ordenes.isLoading()"
            [etiqueta]="'taller.tablero.titulo' | transloco"
            [orden]="orden()"
            (ordenChange)="ordenar($event)"
            [pagina]="filtros().page"
            [tamano]="tamanoPagina"
            [total]="ordenes.value()?.totalElements"
            (paginaCambio)="filtrar({ page: $event || null }, false)"
            filasClicables
            (filaClic)="abrir($event)"
            vacioIcono="wrench"
            [vacioTitulo]="'taller.tablero.vacio_titulo' | transloco"
            [vacioTexto]="'taller.tablero.vacio_texto' | transloco"
          >
            <ng-template hkCelda="numero" let-o>
              <span class="font-medium whitespace-nowrap text-fg tabular">{{ o.numero }}</span>
            </ng-template>
            <ng-template hkCelda="placa" let-o>
              <hk-placa tamano="sm" [placa]="o.placa" />
            </ng-template>
            <ng-template hkCelda="cliente" let-o>
              <p class="font-medium text-fg">{{ o.cliente }}</p>
              <p class="text-xs text-muted">{{ o.moto }}</p>
            </ng-template>
            <ng-template hkCelda="mecanicos" let-o>
              <hk-mecanicos-avatares [mecanicos]="o.mecanicos" />
            </ng-template>
            <ng-template hkCelda="estado" let-o>
              <hk-status-badge [estado]="o.estado" />
            </ng-template>
            <ng-template hkCelda="fechaIngreso" let-o>
              <p class="whitespace-nowrap text-fg tabular">{{ o.fechaIngreso | fecha: 'corta' }}</p>
              <p class="text-xs whitespace-nowrap text-muted">
                {{ o.fechaIngreso | tiempoRelativo }}
              </p>
            </ng-template>
          </hk-table>
        } @else {
          <div
            class="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2"
            [attr.aria-busy]="ordenes.isLoading()"
          >
            @for (estado of columnasKanban(); track estado) {
              <section
                class="flex w-72 shrink-0 snap-start flex-col rounded-xl bg-surface-2 p-3"
                [attr.aria-labelledby]="'kanban-' + estado"
              >
                <h2 [id]="'kanban-' + estado" class="mb-3 flex items-center justify-between gap-2">
                  <hk-status-badge [estado]="estado" />
                  <span class="text-sm font-semibold text-muted tabular">{{
                    resumen.value()?.[estado] ?? porEstado()[estado].length
                  }}</span>
                </h2>
                <ul class="flex flex-col gap-2">
                  @if (ordenes.isLoading()) {
                    <li><hk-skeleton variante="rectangulo" alto="6rem" /></li>
                  } @else {
                    @for (o of porEstado()[estado]; track o.id) {
                      <li>
                        <a
                          class="block rounded-lg border border-border bg-surface p-3 shadow-card hk-foco transition-shadow hover:shadow-overlay"
                          [routerLink]="['/ordenes', o.id]"
                        >
                          <span class="flex items-center justify-between gap-2">
                            <hk-placa tamano="sm" [placa]="o.placa" />
                            <span class="text-xs font-medium text-muted tabular">{{
                              o.numero
                            }}</span>
                          </span>
                          <span class="mt-2 block truncate text-sm font-medium text-fg">{{
                            o.cliente
                          }}</span>
                          <span class="block truncate text-xs text-muted">{{ o.moto }}</span>
                          <span class="mt-2 flex items-center justify-between gap-2">
                            <hk-mecanicos-avatares [mecanicos]="o.mecanicos" />
                            <span class="text-xs text-muted">{{
                              o.fechaIngreso | tiempoRelativo
                            }}</span>
                          </span>
                        </a>
                      </li>
                    } @empty {
                      <li
                        class="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted"
                      >
                        {{ 'taller.tablero.columna_vacia' | transloco }}
                      </li>
                    }
                  }
                </ul>
              </section>
            }
          </div>
        }
      </div>
    </hk-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdenesPage {
  private readonly api = inject(OrdenesApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  protected readonly tamanoPagina = TAMANO_PAGINA;
  protected readonly estados = ESTADOS_ORDEN;
  protected readonly vistas = [
    { id: 'lista', icono: 'clipboard-list' },
    { id: 'kanban', icono: 'layout-dashboard' },
  ] as const;

  private readonly parametros = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly vista = computed<Vista>(() =>
    this.parametros().get('vista') === 'kanban' ? 'kanban' : 'lista',
  );
  protected readonly filtros = computed<FiltrosOrdenes>(() => {
    const p = this.parametros();
    const kanban = this.vista() === 'kanban';
    return {
      q: p.get('q') ?? '',
      estados: p.getAll('estado').filter(esEstado),
      mecanicoId: aNumero(p.get('mecanico')),
      desde: p.get('desde'),
      hasta: p.get('hasta'),
      page: kanban ? 0 : (aNumero(p.get('page')) ?? 0),
      size: kanban ? TAMANO_KANBAN : TAMANO_PAGINA,
      sort: p.get('sort') ?? ORDEN_POR_DEFECTO,
    };
  });

  protected readonly ordenes = rxResource({
    params: () => this.filtros(),
    stream: ({ params }) => this.api.listar(params, erroresManejados()),
  });
  protected readonly resumen = rxResource({
    stream: () => this.api.resumenEstados(erroresManejados()),
  });
  /** Solo quien asigna o ve todas puede listar mecánicos; para los demás no hay filtro. */
  private readonly mecanicos = rxResource({
    stream: () =>
      this.auth.tieneAlguno(['ORDENES_ASIGNAR', 'ORDENES_VER_TODAS'])
        ? this.api.mecanicos(erroresManejados())
        : of([]),
  });
  protected readonly opcionesMecanico = computed<OpcionSelect[]>(() =>
    (this.mecanicos.value() ?? []).map((m) => ({ valor: String(m.id), etiqueta: m.nombre })),
  );

  protected readonly orden = computed<OrdenTabla | null>(() => {
    const [columna, direccion] = (this.filtros().sort ?? '').split(',');
    return columna ? { columna, direccion: direccion === 'desc' ? 'desc' : 'asc' } : null;
  });

  protected readonly columnasKanban = computed(() =>
    this.filtros().estados.length > 0
      ? ESTADOS_ORDEN.filter((e) => this.filtros().estados.includes(e))
      : ESTADOS_ORDEN,
  );
  protected readonly porEstado = computed(() => {
    const grupos = Object.fromEntries(
      ESTADOS_ORDEN.map((e) => [e, [] as OrdenResumen[]]),
    ) as Record<EstadoOrden, OrdenResumen[]>;
    for (const orden of this.ordenes.value()?.content ?? []) grupos[orden.estado].push(orden);
    return grupos;
  });

  private readonly textos = translateSignal([
    'taller.campos.numero',
    'taller.campos.placa',
    'taller.campos.cliente',
    'taller.campos.mecanicos',
    'comun.estado.titulo',
    'taller.campos.fecha_ingreso',
  ]);
  protected readonly columnas = computed<ColumnaTabla[]>(() => {
    const [numero, placa, cliente, mecanicos, estado, fecha] = this.textos();
    return [
      { clave: 'numero', etiqueta: numero, ordenable: true, principal: true },
      { clave: 'placa', etiqueta: placa },
      { clave: 'cliente', etiqueta: cliente },
      { clave: 'mecanicos', etiqueta: mecanicos, ocultarEnMovil: true },
      { clave: 'estado', etiqueta: estado, ordenable: true },
      { clave: 'fechaIngreso', etiqueta: fecha, ordenable: true },
    ];
  });

  /** Cambia al cargar las traducciones o el idioma: los `computed` que traducen la leen. */
  private readonly traducciones = toSignal(this.transloco.selectTranslation());
  protected readonly filtrosActivos = computed<FiltroActivo[]>(() => {
    this.traducciones();
    const f = this.filtros();
    const t = (clave: string, params?: Record<string, unknown>) =>
      this.transloco.translate(clave, params);
    const activos: FiltroActivo[] = f.estados.map((e) => ({
      clave: `estado:${e}`,
      etiqueta: t(`estados.orden.${e}`),
    }));
    if (f.mecanicoId !== null) {
      const nombre = this.opcionesMecanico().find((m) => m.valor === String(f.mecanicoId));
      activos.push({ clave: 'mecanico', etiqueta: nombre?.etiqueta ?? `#${f.mecanicoId}` });
    }
    if (f.desde)
      activos.push({
        clave: 'desde',
        etiqueta: t('taller.tablero.chip_desde', { fecha: f.desde }),
      });
    if (f.hasta)
      activos.push({
        clave: 'hasta',
        etiqueta: t('taller.tablero.chip_hasta', { fecha: f.hasta }),
      });
    return activos;
  });

  protected iconoEstado(estado: EstadoOrden): string {
    return ESTILO_ESTADO_ORDEN[estado].icono;
  }

  /** Cambia parámetros de la URL; `null` los quita. Por defecto vuelve a la primera página. */
  protected filtrar(cambio: Params, reiniciarPagina = true): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...(reiniciarPagina ? { page: null } : {}), ...cambio },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected alternarEstado(estado: EstadoOrden): void {
    const actuales = this.filtros().estados;
    const nuevos = actuales.includes(estado)
      ? actuales.filter((e) => e !== estado)
      : ESTADOS_ORDEN.filter((e) => e === estado || actuales.includes(e));
    this.filtrar({ estado: nuevos.length > 0 ? nuevos : null });
  }

  protected quitarFiltro(clave: string): void {
    if (clave.startsWith('estado:')) {
      const estado = clave.slice('estado:'.length);
      if (esEstado(estado)) this.alternarEstado(estado);
      return;
    }
    this.filtrar({ [clave]: null });
  }

  protected ordenar(orden: OrdenTabla | null): void {
    this.filtrar({ sort: orden ? `${orden.columna},${orden.direccion}` : null });
  }

  protected abrir(orden: OrdenResumen): void {
    void this.router.navigate(['/ordenes', orden.id]);
  }
}
