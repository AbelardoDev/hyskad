import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';

import { ControlBase } from './campo';

export interface OpcionCombobox {
  valor: string;
  /** Texto ya traducido. */
  etiqueta: string;
  descripcion?: string;
}

const POSICIONES: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
];

const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Búsqueda con autocompletado (patrón ARIA "combobox" con lista emergente).
 * Filtra localmente o, con `filtrarLocal=false`, deja la búsqueda al consumidor vía `busqueda`.
 */
@Component({
  selector: 'hk-combobox',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, LucideDynamicIcon, TranslocoPipe],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HkCombobox), multi: true },
  ],
  template: `
    <div class="relative" cdkOverlayOrigin #origen="cdkOverlayOrigin">
      <svg
        lucideIcon="search"
        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        #campo
        type="text"
        role="combobox"
        autocomplete="off"
        class="hk-control pr-10 pl-9"
        [id]="idControl()"
        [value]="textoVisible()"
        [placeholder]="placeholder() ?? ''"
        [disabled]="estaDeshabilitado()"
        [attr.aria-expanded]="abierto()"
        [attr.aria-controls]="idLista()"
        aria-autocomplete="list"
        [attr.aria-activedescendant]="abierto() && activo() >= 0 ? idOpcion(activo()) : null"
        [attr.aria-invalid]="invalido() || null"
        [attr.aria-describedby]="descritoPor()"
        [attr.aria-required]="requerido() || null"
        (input)="alEscribir($event)"
        (keydown)="alTeclear($event)"
        (click)="abrir()"
        (blur)="alSalir()"
      />
      <span
        class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
        aria-hidden="true"
      >
        @if (cargando()) {
          <svg lucideIcon="loader-circle" class="size-4 animate-spin" />
        } @else {
          <svg lucideIcon="chevrons-up-down" class="size-4" />
        }
      </span>
    </div>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origen"
      [cdkConnectedOverlayOpen]="abierto()"
      [cdkConnectedOverlayPositions]="posiciones"
      [cdkConnectedOverlayWidth]="anchoLista()"
      (overlayOutsideClick)="cerrar()"
      (detach)="cerrar()"
    >
      <ul
        [id]="idLista()"
        role="listbox"
        class="max-h-64 w-full hk-overlay overflow-y-auto p-1"
        [attr.aria-label]="placeholder() ?? null"
      >
        @for (opcion of visibles(); track opcion.valor; let i = $index) {
          <li
            [id]="idOpcion(i)"
            role="option"
            tabindex="-1"
            class="flex cursor-pointer flex-col rounded-lg px-3 py-2 text-sm"
            [class.bg-surface-2]="i === activo()"
            [attr.aria-selected]="opcion.valor === valor()"
            (mousedown)="$event.preventDefault()"
            (click)="seleccionar(opcion)"
            (keydown.enter)="seleccionar(opcion)"
            (mouseenter)="activo.set(i)"
          >
            <span class="flex items-center justify-between gap-2 font-medium text-fg">
              {{ opcion.etiqueta }}
              @if (opcion.valor === valor()) {
                <svg lucideIcon="check" class="size-4 text-primary" aria-hidden="true" />
              }
            </span>
            @if (opcion.descripcion) {
              <span class="text-xs text-muted">{{ opcion.descripcion }}</span>
            }
          </li>
        } @empty {
          <li class="px-3 py-6 text-center text-sm text-muted" role="presentation">
            {{ (cargando() ? 'comun.cargando' : 'ui.combobox.sin_resultados') | transloco }}
          </li>
        }
      </ul>
    </ng-template>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkCombobox extends ControlBase<string | null> {
  readonly valor = model<string | null>(null);
  readonly opciones = input<readonly OpcionCombobox[]>([]);
  readonly placeholder = input<string>();
  readonly cargando = input(false, { transform: booleanAttribute });
  readonly filtrarLocal = input(true, { transform: booleanAttribute });
  /** Texto que escribe el usuario (para buscar en el servidor). */
  readonly busqueda = output<string>();

  protected readonly posiciones = POSICIONES;
  protected readonly idLista = computed(() => `${this.idControl()}-lista`);
  protected readonly abierto = signal(false);
  protected readonly activo = signal(-1);
  private readonly consulta = signal<string | null>(null);
  /** Se guarda aparte porque las opciones pueden cambiar con cada búsqueda en el servidor. */
  private readonly etiquetaSeleccionada = signal('');

  protected readonly visibles = computed(() => {
    const consulta = this.consulta();
    if (!this.filtrarLocal() || !consulta) return this.opciones();
    const buscado = normalizar(consulta);
    return this.opciones().filter((o) =>
      normalizar(`${o.etiqueta} ${o.descripcion ?? ''}`).includes(buscado),
    );
  });

  protected readonly textoVisible = computed(() => this.consulta() ?? this.etiquetaSeleccionada());
  protected readonly anchoLista = signal<number | string>('100%');
  private readonly campoTexto = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  constructor() {
    super();
    effect(() => {
      const valor = this.valor();
      const opcion = this.opciones().find((o) => o.valor === valor);
      if (opcion) this.etiquetaSeleccionada.set(opcion.etiqueta);
      else if (valor === null) this.etiquetaSeleccionada.set('');
    });
  }

  protected idOpcion(indice: number): string {
    return `${this.idLista()}-${indice}`;
  }

  protected abrir(): void {
    if (this.estaDeshabilitado()) return;
    this.anchoLista.set(this.campoTexto().nativeElement.getBoundingClientRect().width);
    this.abierto.set(true);
    const seleccionada = this.visibles().findIndex((o) => o.valor === this.valor());
    this.activo.set(seleccionada >= 0 ? seleccionada : 0);
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.activo.set(-1);
    this.consulta.set(null);
  }

  protected seleccionar(opcion: OpcionCombobox): void {
    this.etiquetaSeleccionada.set(opcion.etiqueta);
    this.actualizar(opcion.valor);
    this.cerrar();
  }

  protected alEscribir(evento: Event): void {
    const texto = this.texto(evento);
    this.consulta.set(texto);
    this.busqueda.emit(texto);
    if (!this.abierto()) this.abrir();
    this.activo.set(0);
    if (texto === '' && this.valor() !== null) {
      this.etiquetaSeleccionada.set('');
      this.actualizar(null);
    }
  }

  protected alTeclear(evento: KeyboardEvent): void {
    const total = this.visibles().length;
    switch (evento.key) {
      case 'ArrowDown':
        evento.preventDefault();
        if (!this.abierto()) this.abrir();
        else if (total > 0) this.activo.set((this.activo() + 1) % total);
        break;
      case 'ArrowUp':
        evento.preventDefault();
        if (!this.abierto()) this.abrir();
        else if (total > 0) this.activo.set((this.activo() - 1 + total) % total);
        break;
      case 'Home':
      case 'End':
        if (this.abierto() && total > 0) {
          evento.preventDefault();
          this.activo.set(evento.key === 'Home' ? 0 : total - 1);
        }
        break;
      case 'Enter': {
        const opcion = this.visibles()[this.activo()];
        if (this.abierto() && opcion) {
          evento.preventDefault();
          this.seleccionar(opcion);
        }
        break;
      }
      case 'Escape':
        if (this.abierto()) {
          evento.preventDefault();
          evento.stopPropagation();
          this.cerrar();
        }
        break;
      case 'Tab':
        this.cerrar();
        break;
    }
  }

  protected alSalir(): void {
    this.cerrar();
    this.tocar();
  }
}
