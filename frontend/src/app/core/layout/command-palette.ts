import { DialogRef } from '@angular/cdk/dialog';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LucideDynamicIcon } from '@lucide/angular';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { HK_ID_TITULO_DIALOGO } from '../../shared/ui/dialog/dialogos.service';
import { HkPlaca } from '../../shared/ui/placa/placa';
import { AuthService } from '../auth/auth.service';
import { Permiso } from '../auth/permisos';
import { erroresManejados } from '../http/contexto-http';
import { ThemeService } from '../theme/theme.service';
import {
  BusquedaApiService,
  ItemBusqueda,
  MINIMO_BUSQUEDA,
  ResultadoBusqueda,
} from './busqueda-api.service';
import { NavegacionService } from './navegacion.service';

/** Espera tras la última tecla antes de buscar. */
export const DEBOUNCE_BUSQUEDA_MS = 250;

type TipoResultado = keyof ResultadoBusqueda;

/** Orden, ícono y ruta de cada tipo de resultado. */
const TIPOS: readonly { tipo: TipoResultado; icono: string; ruta: (id: number) => unknown[] }[] = [
  { tipo: 'motocicletas', icono: 'bike', ruta: (id) => ['/motocicletas', id] },
  { tipo: 'ordenes', icono: 'clipboard-list', ruta: (id) => ['/ordenes', id] },
  { tipo: 'clientes', icono: 'user', ruta: (id) => ['/clientes', id] },
  { tipo: 'productos', icono: 'package', ruta: (id) => ['/inventario/productos', id] },
  { tipo: 'ventas', icono: 'shopping-cart', ruta: (id) => ['/ventas', id] },
];

interface AccionRapida {
  id: string;
  icono: string;
  permiso: Permiso | null;
  url: string | null;
}

/** Acciones rápidas según permisos; `url` nula = acción local (cambiar tema). */
const ACCIONES: readonly AccionRapida[] = [
  { id: 'nueva_venta', icono: 'shopping-cart', permiso: 'VENTAS_CREAR', url: '/ventas/nueva' },
  { id: 'recibir_moto', icono: 'bike', permiso: 'ORDENES_CREAR', url: '/ordenes/nueva' },
  { id: 'nuevo_cliente', icono: 'plus', permiso: 'CLIENTES_GESTIONAR', url: '/clientes?nuevo=1' },
  { id: 'cambiar_tema', icono: 'moon', permiso: null, url: null },
];

export interface OpcionPaleta {
  id: string;
  icono: string;
  titulo: string;
  detalle?: string;
  /** El título es una placa (se muestra con `hk-placa`). */
  placa?: boolean;
  ejecutar: () => void;
}

export interface GrupoPaleta {
  id: string;
  titulo: string;
  opciones: OpcionPaleta[];
}

/** Minúsculas y sin tildes, para comparar lo escrito con los nombres de las acciones. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Paleta de comandos (`Ctrl/⌘ + K`, RF29): busca clientes, motos por placa, órdenes, productos y
 * ventas (`GET /busqueda`, 250 ms después de la última tecla), y ofrece acciones rápidas y páginas
 * según los permisos. Patrón ARIA combobox + listbox: flechas para moverse, Enter para abrir y Esc
 * para cerrar.
 */
@Component({
  selector: 'hk-command-palette',
  imports: [TranslocoPipe, LucideDynamicIcon, HkPlaca],
  template: `
    <h2 class="sr-only" [id]="idTitulo">{{ 'paleta.titulo' | transloco }}</h2>
    <div class="flex items-center gap-3 border-b border-border px-4">
      <svg lucideIcon="search" class="size-5 shrink-0 text-muted" aria-hidden="true" />
      <input
        type="text"
        role="combobox"
        class="h-14 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        aria-expanded="true"
        [attr.aria-controls]="idLista"
        [attr.aria-activedescendant]="idActiva()"
        [attr.aria-labelledby]="idTitulo"
        [placeholder]="'paleta.placeholder' | transloco"
        [value]="q()"
        (input)="escribir($event)"
        (keydown)="alTeclear($event)"
      />
      @if (buscando()) {
        <svg
          lucideIcon="loader-circle"
          class="size-4 shrink-0 animate-spin text-muted"
          aria-hidden="true"
        />
      }
      <kbd
        class="hidden rounded-md border border-border bg-surface-2 px-1.5 text-[0.6875rem] font-medium text-muted sm:inline"
        aria-hidden="true"
        >Esc</kbd
      >
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-2" [id]="idLista" role="listbox">
      @for (grupo of grupos(); track grupo.id) {
        <div role="group" [attr.aria-labelledby]="idLista + '-' + grupo.id" class="mb-1">
          <p
            class="px-2.5 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase"
            [id]="idLista + '-' + grupo.id"
          >
            {{ grupo.titulo }}
          </p>
          @for (opcion of grupo.opciones; track opcion.id) {
            <div
              role="option"
              class="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2"
              [class]="opcion.id === activa()?.id ? 'bg-surface-2 text-fg' : 'text-fg'"
              [id]="idOpcion(opcion)"
              [attr.aria-selected]="opcion.id === activa()?.id"
              tabindex="-1"
              (mousemove)="activar(opcion)"
              (click)="ejecutar(opcion)"
              (keydown.enter)="ejecutar(opcion)"
            >
              <span
                class="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface"
              >
                <svg [lucideIcon]="opcion.icono" class="size-4 text-muted" aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                @if (opcion.placa) {
                  <hk-placa tamano="sm" [placa]="opcion.titulo" />
                } @else {
                  <span class="block truncate text-sm font-medium">{{ opcion.titulo }}</span>
                }
                @if (opcion.detalle) {
                  <span class="block truncate text-xs text-muted">{{ opcion.detalle }}</span>
                }
              </span>
            </div>
          }
        </div>
      }

      @if (resultado.error()) {
        <p class="px-3 py-6 text-center text-sm text-muted" role="status">
          {{ 'paleta.error' | transloco }}
        </p>
      } @else if (sinResultados()) {
        <p class="px-3 py-6 text-center text-sm text-muted" role="status">
          {{ 'paleta.sin_resultados' | transloco: { q: termino() } }}
        </p>
      } @else if (q().trim().length > 0 && q().trim().length < minimo) {
        <p class="px-3 py-4 text-center text-xs text-muted">
          {{ 'paleta.minimo' | transloco: { n: minimo } }}
        </p>
      }
    </div>

    <footer
      class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface-2/50 px-4 py-2.5 text-xs text-muted max-sm:hidden"
      aria-hidden="true"
    >
      <span
        ><kbd class="font-sans">↑</kbd> <kbd class="font-sans">↓</kbd>
        {{ 'paleta.navegar' | transloco }}</span
      >
      <span><kbd class="font-sans">Enter</kbd> {{ 'paleta.abrir' | transloco }}</span>
      <span><kbd class="font-sans">Esc</kbd> {{ 'paleta.cerrar' | transloco }}</span>
    </footer>
  `,
  host: {
    class:
      'flex max-h-[min(36rem,calc(100dvh-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface text-fg shadow-overlay animate-entrada',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HkCommandPalette {
  private readonly api = inject(BusquedaApiService);
  private readonly auth = inject(AuthService);
  private readonly navegacion = inject(NavegacionService);
  private readonly router = inject(Router);
  private readonly tema = inject(ThemeService);
  private readonly transloco = inject(TranslocoService);
  private readonly documento = inject(DOCUMENT);
  private readonly dialogRef = inject(DialogRef, { optional: true });

  protected readonly idTitulo =
    inject(HK_ID_TITULO_DIALOGO, { optional: true }) ?? 'hk-paleta-titulo';
  protected readonly idLista = 'hk-paleta-lista';
  protected readonly minimo = MINIMO_BUSQUEDA;

  protected readonly q = signal('');
  /** Lo escrito, 250 ms después de la última tecla. */
  protected readonly termino = toSignal(
    toObservable(this.q).pipe(
      map((q) => q.trim()),
      debounceTime(DEBOUNCE_BUSQUEDA_MS),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );
  protected readonly resultado = rxResource({
    params: () => (this.termino().length >= MINIMO_BUSQUEDA ? this.termino() : undefined),
    stream: ({ params }) => this.api.buscar(params, erroresManejados()),
  });
  protected readonly buscando = computed(() => {
    const q = this.q().trim();
    return q.length >= MINIMO_BUSQUEDA && (q !== this.termino() || this.resultado.isLoading());
  });

  private readonly traducciones = toSignal(this.transloco.selectTranslation());

  private readonly gruposResultados = computed<GrupoPaleta[]>(() => {
    this.traducciones();
    if (!this.resultado.hasValue() || this.termino().length < MINIMO_BUSQUEDA) return [];
    const r = this.resultado.value();
    return TIPOS.filter(({ tipo }) => r[tipo].length > 0).map(({ tipo, icono, ruta }) => ({
      id: tipo,
      titulo: this.transloco.translate(`paleta.tipos.${tipo}`),
      opciones: r[tipo].map((item) => ({
        id: `${tipo}-${item.id}`,
        icono,
        titulo: item.titulo,
        detalle: this.detalle(tipo, item),
        placa: tipo === 'motocicletas',
        ejecutar: () => this.ir(ruta(item.id)),
      })),
    }));
  });

  private readonly grupoAcciones = computed<GrupoPaleta | null>(() => {
    this.traducciones();
    const q = normalizar(this.q());
    const oscuro = this.tema.oscuro();
    const opciones = ACCIONES.filter((a) => !a.permiso || this.auth.tienePermiso(a.permiso))
      .map<OpcionPaleta>((a) => {
        const tema = a.id === 'cambiar_tema';
        return {
          id: `accion-${a.id}`,
          icono: tema ? (oscuro ? 'sun' : 'moon') : a.icono,
          titulo: this.transloco.translate(
            tema
              ? `paleta.acciones.tema_${oscuro ? 'claro' : 'oscuro'}`
              : `paleta.acciones.${a.id}`,
          ),
          ejecutar: () => (a.url ? this.ir(a.url) : this.tema.cambiar(oscuro ? 'light' : 'dark')),
        };
      })
      .filter((o) => !q || normalizar(o.titulo).includes(q));
    return opciones.length
      ? { id: 'acciones', titulo: this.transloco.translate('paleta.acciones.titulo'), opciones }
      : null;
  });

  /** Páginas del menú que coinciden con lo escrito (solo al escribir). */
  private readonly grupoPaginas = computed<GrupoPaleta | null>(() => {
    this.traducciones();
    const q = normalizar(this.q());
    if (!q) return null;
    const opciones = this.navegacion
      .grupos()
      .flatMap((g) => g.items)
      .map<OpcionPaleta>((item) => ({
        id: `pagina-${item.ruta}`,
        icono: item.icono,
        titulo: this.transloco.translate(item.clave),
        ejecutar: () => this.ir(item.ruta),
      }))
      .filter((o) => normalizar(o.titulo).includes(q));
    return opciones.length
      ? { id: 'paginas', titulo: this.transloco.translate('paleta.paginas'), opciones }
      : null;
  });

  protected readonly grupos = computed<GrupoPaleta[]>(() =>
    [...this.gruposResultados(), this.grupoAcciones(), this.grupoPaginas()].filter(
      (g): g is GrupoPaleta => g !== null,
    ),
  );
  private readonly opciones = computed(() => this.grupos().flatMap((g) => g.opciones));
  /** La opción resaltada vuelve a la primera cuando cambia la lista. */
  private readonly indice = linkedSignal({ source: this.opciones, computation: () => 0 });
  protected readonly activa = computed<OpcionPaleta | undefined>(
    () => this.opciones()[this.indice()],
  );
  protected readonly idActiva = computed(() => {
    const activa = this.activa();
    return activa ? this.idOpcion(activa) : null;
  });
  protected readonly sinResultados = computed(
    () =>
      this.termino().length >= MINIMO_BUSQUEDA &&
      !this.buscando() &&
      this.resultado.hasValue() &&
      this.gruposResultados().length === 0,
  );

  constructor() {
    // La opción resaltada siempre a la vista
    afterRenderEffect(() => {
      const id = this.idActiva();
      if (id) this.documento.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  protected idOpcion(opcion: OpcionPaleta): string {
    return `${this.idLista}-${opcion.id}`.replace(/[^\w-]/g, '_');
  }

  protected activar(opcion: OpcionPaleta): void {
    const i = this.opciones().indexOf(opcion);
    if (i >= 0 && i !== this.indice()) this.indice.set(i);
  }

  protected escribir(evento: Event): void {
    this.q.set((evento.target as HTMLInputElement).value);
  }

  protected alTeclear(evento: KeyboardEvent): void {
    const total = this.opciones().length;
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!total) return;
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      this.indice.update((i) => (i + paso + total) % total);
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      const activa = this.activa();
      if (activa) this.ejecutar(activa);
    }
  }

  protected ejecutar(opcion: OpcionPaleta): void {
    this.dialogRef?.close();
    opcion.ejecutar();
  }

  private ir(destino: string | unknown[]): void {
    void (typeof destino === 'string'
      ? this.router.navigateByUrl(destino)
      : this.router.navigate(destino));
  }

  /** Traduce el estado al final del detalle de órdenes y ventas, y rotula el disponible. */
  private detalle(tipo: TipoResultado, item: ItemBusqueda): string {
    const partes = item.detalle.split(' · ').filter(Boolean);
    const ultima = partes.length - 1;
    if (tipo === 'ordenes' && ultima >= 0) {
      partes[ultima] = this.transloco.translate(`estados.orden.${partes[ultima]}`);
    } else if (tipo === 'ventas' && ultima >= 0) {
      partes[ultima] = this.transloco.translate(`ventas.estados.${partes[ultima]}`);
    } else if (tipo === 'productos' && partes.length === 2) {
      partes[1] = this.transloco.translate('paleta.disponible', { n: partes[1] });
    }
    return partes.join(' · ');
  }
}
