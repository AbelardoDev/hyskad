import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { finalize, Observable } from 'rxjs';

import {
  conFormulario,
  erroresManejados,
  marcarErroresServidor,
} from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import { aCantidad, cantidad } from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { HkDrawer } from '../../shared/ui/dialog/drawer';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkMoneyInput } from '../../shared/ui/forms/money-input';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { HkTextarea } from '../../shared/ui/forms/textarea';
import {
  Categoria,
  DatosProducto,
  InventarioApiService,
  Producto,
  Unidad,
  UNIDADES,
} from './inventario-api.service';

export interface DatosFormProducto {
  /** Si viene, se edita; si no, se crea. */
  producto?: Producto;
}

/** Código de repuesto: letras, números y `- _ . /`, como `GuardarProducto.CODIGO`. */
export const PATRON_CODIGO = /^\s*[A-Za-z0-9][A-Za-z0-9._/-]*\s*$/;

/**
 * Crear o editar un producto del catálogo (RF17). El stock no se edita aquí: nace en 0 y cambia
 * con compras y ajustes. La categoría se puede crear sin salir del formulario.
 */
@Component({
  selector: 'hk-producto-form-drawer',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkButton,
    HkDrawer,
    HkFormField,
    HkInput,
    HkMoneyInput,
    HkSelect,
    HkTextarea,
  ],
  template: `
    <hk-drawer
      [titulo]="
        (producto ? 'inventario.form.titulo_editar' : 'inventario.form.titulo_nuevo') | transloco
      "
    >
      <form
        id="form-producto"
        class="space-y-5"
        [formGroup]="form"
        (ngSubmit)="guardar()"
        novalidate
      >
        <div class="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <hk-form-field
            [etiqueta]="'inventario.campos.codigo' | transloco"
            [ayuda]="'inventario.form.codigo_ayuda' | transloco"
          >
            <hk-input formControlName="codigo" autocompletar="off" [maxCaracteres]="40" />
          </hk-form-field>
          <hk-form-field [etiqueta]="'inventario.campos.nombre' | transloco">
            <hk-input formControlName="nombre" autocompletar="off" [maxCaracteres]="150" />
          </hk-form-field>
        </div>

        <div>
          <hk-form-field [etiqueta]="'inventario.campos.categoria' | transloco">
            <hk-select
              formControlName="categoriaId"
              [opciones]="opcionesCategoria()"
              [placeholder]="'inventario.form.elige_categoria' | transloco"
            />
          </hk-form-field>
          @if (creandoCategoria()) {
            <div
              class="mt-3 flex items-end gap-2 rounded-xl border border-border bg-surface-2/60 p-3"
            >
              <hk-form-field class="flex-1" [etiqueta]="'inventario.categorias.nueva' | transloco">
                <hk-input
                  formControlName="nuevaCategoria"
                  autocompletar="off"
                  [maxCaracteres]="80"
                />
              </hk-form-field>
              <button
                hk-button
                type="button"
                variante="secondary"
                [cargando]="guardandoCategoria()"
                (click)="crearCategoria()"
              >
                {{ 'inventario.categorias.crear' | transloco }}
              </button>
            </div>
          } @else {
            <button
              type="button"
              class="mt-2 rounded text-xs font-medium text-primary hk-foco hover:underline"
              (click)="creandoCategoria.set(true)"
            >
              + {{ 'inventario.categorias.nueva' | transloco }}
            </button>
          }
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <hk-form-field [etiqueta]="'inventario.campos.marca' | transloco" [opcional]="true">
            <hk-input formControlName="marca" autocompletar="off" [maxCaracteres]="80" />
          </hk-form-field>
          <hk-form-field [etiqueta]="'inventario.campos.unidad' | transloco">
            <hk-select formControlName="unidad" [opciones]="opcionesUnidad()" />
          </hk-form-field>
        </div>
        <div class="grid gap-5 sm:grid-cols-2">
          <hk-form-field
            [etiqueta]="'inventario.campos.precio' | transloco"
            [ayuda]="'inventario.form.precio_ayuda' | transloco"
          >
            <hk-money-input formControlName="precioVenta" />
          </hk-form-field>
          <hk-form-field
            [etiqueta]="'inventario.campos.minimo' | transloco"
            [ayuda]="'inventario.form.minimo_ayuda' | transloco"
          >
            <hk-input formControlName="stockMinimo" modoTeclado="decimal" [maxCaracteres]="13" />
          </hk-form-field>
        </div>
        <hk-form-field [etiqueta]="'inventario.campos.descripcion' | transloco" [opcional]="true">
          <hk-textarea formControlName="descripcion" [filas]="3" [maxCaracteres]="500" />
        </hk-form-field>
        @if (!producto) {
          <p class="rounded-xl bg-info-soft px-4 py-3 text-xs text-info-ink">
            {{ 'inventario.form.stock_inicial' | transloco }}
          </p>
        }
      </form>
      <div hkDrawerPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button hk-button tipo="submit" form="form-producto" icono="check" [cargando]="guardando()">
          {{ 'comun.guardar' | transloco }}
        </button>
      </div>
    </hk-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoFormDrawer {
  private readonly api = inject(InventarioApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Producto>>(DialogRef);
  protected readonly producto = inject<DatosFormProducto | undefined>(DIALOG_DATA)?.producto;

  protected readonly guardando = signal(false);
  protected readonly creandoCategoria = signal(false);
  protected readonly guardandoCategoria = signal(false);
  /** Categorías creadas aquí, para listarlas antes de recargar. */
  private readonly nuevas = signal<Categoria[]>([]);

  protected readonly form = inject(NonNullableFormBuilder).group({
    codigo: [
      this.producto?.codigo ?? '',
      [Validators.required, Validators.maxLength(40), Validators.pattern(PATRON_CODIGO)],
    ],
    nombre: [this.producto?.nombre ?? '', [Validators.required, Validators.maxLength(150)]],
    categoriaId: [this.producto ? String(this.producto.categoria.id) : '', Validators.required],
    marca: [this.producto?.marca ?? '', Validators.maxLength(80)],
    unidad: [(this.producto?.unidad ?? 'UNIDAD') as Unidad, Validators.required],
    precioVenta: [
      this.producto?.precioVenta ?? (null as number | null),
      [Validators.required, Validators.min(1)],
    ],
    stockMinimo: [
      String(this.producto?.stockMinimo ?? 0),
      [Validators.required, cantidad({ positiva: false })],
    ],
    descripcion: [this.producto?.descripcion ?? '', Validators.maxLength(500)],
    nuevaCategoria: ['', Validators.maxLength(80)],
  });

  /** Activas y, al editar, también la actual aunque esté inactiva. */
  private readonly categorias = rxResource({
    stream: () => this.api.categorias(true, erroresManejados()),
  });
  protected readonly opcionesCategoria = computed<OpcionSelect[]>(() => {
    const lista = [...(this.categorias.value() ?? []), ...this.nuevas()];
    const actual = this.producto?.categoria;
    if (actual && !lista.some((c) => c.id === actual.id))
      lista.push({ ...actual, descripcion: null, activo: false });
    return lista
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((c) => ({ valor: String(c.id), etiqueta: c.nombre }));
  });

  private readonly textosUnidad = translateSignal(UNIDADES.map((u) => `inventario.unidades.${u}`));
  protected readonly opcionesUnidad = computed<OpcionSelect[]>(() =>
    UNIDADES.map((valor, i) => ({ valor, etiqueta: this.textosUnidad()[i] })),
  );

  protected crearCategoria(): void {
    const control = this.form.controls.nuevaCategoria;
    const nombre = control.value.trim();
    if (!nombre || this.guardandoCategoria()) return;
    this.guardandoCategoria.set(true);
    this.api
      .crearCategoria({ nombre, descripcion: null }, erroresManejados())
      .pipe(finalize(() => this.guardandoCategoria.set(false)))
      .subscribe({
        next: (categoria) => {
          this.nuevas.update((lista) => [...lista, categoria]);
          this.form.controls.categoriaId.setValue(String(categoria.id));
          control.reset('');
          this.creandoCategoria.set(false);
        },
        error: (e: HttpErrorResponse) => {
          control.setErrors({ servidor: codigoDeError(e) });
          control.markAsTouched();
        },
      });
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const v = this.form.getRawValue();
    const datos: DatosProducto = {
      codigo: v.codigo.trim().toUpperCase(),
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim() || null,
      marca: v.marca.trim() || null,
      categoriaId: Number(v.categoriaId),
      unidad: v.unidad,
      precioVenta: v.precioVenta ?? 0,
      stockMinimo: aCantidad(v.stockMinimo) ?? 0,
    };
    const contexto = conFormulario(this.form);
    const peticion: Observable<Producto> = this.producto
      ? this.api.actualizarProducto(this.producto.id, datos, contexto)
      : this.api.crearProducto(datos, contexto);

    this.guardando.set(true);
    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (guardado) => this.ref.close(guardado),
      error: (e: HttpErrorResponse) => {
        const codigo = codigoDeError(e);
        if (codigo === 'CODIGO_DUPLICADO')
          marcarErroresServidor(this.form, [{ campo: 'codigo', code: codigo }]);
        if (codigo === 'CATEGORIA_INACTIVA')
          marcarErroresServidor(this.form, [{ campo: 'categoriaId', code: codigo }]);
        enfocarPrimerError(this.host.nativeElement, this.injector);
      },
    });
  }
}
