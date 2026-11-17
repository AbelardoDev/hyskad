import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  output,
  Signal,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { desdeParaPeriodo, hoyEnBogota } from '../../core/utils/formato';
import { HkButton } from '../../shared/ui/button/button';
import { HkDateInput } from '../../shared/ui/forms/date-input';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { Periodo } from './reportes-api.service';

/** Días del periodo por defecto (igual que el backend). */
export const DIAS_POR_DEFECTO = 30;
export const TAMANO_PAGINA_REPORTE = 20;

/** Los últimos 30 días hasta hoy en Bogotá. */
export function periodoInicial(hoy = hoyEnBogota()): Periodo {
  return { desde: desdeParaPeriodo(hoy, DIAS_POR_DEFECTO), hasta: hoy };
}

/**
 * Paginación en el cliente para el detalle de un reporte (el backend lo envía completo, con un
 * periodo máximo de un año). La página vuelve a 0 cuando cambian las filas.
 */
export function paginar<T>(filas: Signal<readonly T[]>, tamano = TAMANO_PAGINA_REPORTE) {
  const estado = signal<{ filas: readonly T[]; pagina: number }>({ filas: [], pagina: 0 });
  const pagina = computed(() => (estado().filas === filas() ? estado().pagina : 0));
  return {
    pagina,
    tamano,
    total: computed(() => filas().length),
    visibles: computed(() => filas().slice(pagina() * tamano, (pagina() + 1) * tamano)),
    ir: (n: number) => estado.set({ filas: filas(), pagina: n }),
  };
}

/** Desde y hasta de un reporte; `hasta` no puede ser anterior a `desde` ni posterior a hoy. */
@Component({
  selector: 'hk-periodo-reporte',
  imports: [TranslocoPipe, HkDateInput, HkFormField],
  template: `
    <hk-form-field [etiqueta]="'reportes.desde' | transloco">
      <hk-date-input
        [valor]="periodo().desde"
        [max]="periodo().hasta"
        (valorChange)="$event && cambio.emit({ desde: $event, hasta: periodo().hasta })"
      />
    </hk-form-field>
    <hk-form-field [etiqueta]="'reportes.hasta' | transloco">
      <hk-date-input
        [valor]="periodo().hasta"
        [min]="periodo().desde"
        [max]="hoy"
        (valorChange)="$event && cambio.emit({ desde: periodo().desde, hasta: $event })"
      />
    </hk-form-field>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkPeriodoReporte {
  readonly periodo = input.required<Periodo>();
  readonly cambio = output<Periodo>();
  protected readonly hoy = hoyEnBogota();
}

/** Botones "Exportar CSV" e "Imprimir" de un reporte; no se imprimen. */
@Component({
  selector: 'hk-acciones-reporte',
  imports: [TranslocoPipe, HkButton],
  template: `
    @if (exportable()) {
      <button
        hk-button
        variante="secondary"
        icono="download"
        [cargando]="exportando()"
        [deshabilitado]="!listo()"
        (click)="exportar.emit()"
      >
        {{ 'reportes.exportar_csv' | transloco }}
      </button>
    }
    <button
      hk-button
      variante="secondary"
      icono="printer"
      [deshabilitado]="!listo()"
      (click)="imprimir()"
    >
      {{ 'reportes.imprimir' | transloco }}
    </button>
  `,
  host: { class: 'flex flex-wrap items-center gap-2 print:hidden' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkAccionesReporte {
  private readonly documento = inject(DOCUMENT);

  readonly exportable = input(true, { transform: booleanAttribute });
  readonly exportando = input(false, { transform: booleanAttribute });
  /** Hay un resultado cargado para exportar o imprimir. */
  readonly listo = input(true, { transform: booleanAttribute });
  readonly exportar = output();

  protected imprimir(): void {
    this.documento.defaultView?.print();
  }
}
