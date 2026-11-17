import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { finalize, map } from 'rxjs';

import { conFormulario, erroresManejados } from '../../core/http/contexto-http';
import {
  digitoVerificacionNit,
  documentoParaMostrar,
  documentoSegunTipo,
  DIGITOS_NIT,
  normalizarDocumento,
  numeroConDv,
  telefonoColombiano,
} from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { HkCard } from '../../shared/ui/card/card';
import { HkEmptyState } from '../../shared/ui/empty-state/empty-state';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkSwitch } from '../../shared/ui/forms/switch';
import { HkTextarea } from '../../shared/ui/forms/textarea';
import { HkPageHeader } from '../../shared/ui/page-header/page-header';
import { HkSkeleton } from '../../shared/ui/skeleton/skeleton';
import { ToastService } from '../../shared/ui/toast/toast';
import { ConfiguracionApiService, ConfiguracionTaller } from './configuracion-api.service';

/** Porcentaje de 0 a 100 con hasta 2 decimales, con punto o coma (espejo de `@Digits(3, 2)`). */
const PATRON_PORCENTAJE = /^\d{1,3}([.,]\d{1,2})?$/;

/** `"19,5"` → `19.5`; `null` si no es un porcentaje válido. */
export function aPorcentaje(texto: string): number | null {
  const limpio = texto.trim();
  if (!PATRON_PORCENTAJE.test(limpio)) return null;
  const valor = Number(limpio.replace(',', '.'));
  return valor <= 100 ? valor : null;
}

/**
 * Configuración del taller (F11): datos que salen en comprobantes y correos (nombre, NIT con DV,
 * dirección, teléfono y correo), IVA vigente para los documentos nuevos (RN-03), texto de
 * autorización de datos (RN-45) y alerta de stock bajo (RN-14). Cada cambio queda auditado (RN-51).
 */
@Component({
  selector: 'hk-configuracion-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkButton,
    HkCard,
    HkEmptyState,
    HkFormField,
    HkInput,
    HkPageHeader,
    HkSkeleton,
    HkSwitch,
    HkTextarea,
  ],
  template: `
    <hk-page-header
      [titulo]="'configuracion.titulo' | transloco"
      [subtitulo]="'configuracion.subtitulo' | transloco"
    >
      @if (config.hasValue()) {
        <button
          hk-button
          hkAccionPrincipal
          tipo="submit"
          form="form-configuracion"
          icono="check"
          [cargando]="guardando()"
          [deshabilitado]="!modificado()"
        >
          {{ 'configuracion.guardar' | transloco }}
        </button>
      }
    </hk-page-header>

    @if (config.error()) {
      <hk-empty-state
        icono="circle-alert"
        [titulo]="'configuracion.error' | transloco"
        [texto]="'comun.error_texto' | transloco"
      >
        <button hk-button variante="secondary" icono="rotate-ccw" (click)="config.reload()">
          {{ 'comun.reintentar' | transloco }}
        </button>
      </hk-empty-state>
    } @else if (!config.hasValue()) {
      <div class="grid max-w-4xl gap-6" aria-busy="true">
        <hk-skeleton variante="rectangulo" alto="20rem" />
        <hk-skeleton variante="rectangulo" alto="9rem" />
        <hk-skeleton variante="rectangulo" alto="14rem" />
      </div>
    } @else {
      <form
        id="form-configuracion"
        class="grid max-w-4xl gap-6"
        [formGroup]="form"
        (ngSubmit)="guardar()"
        novalidate
      >
        <hk-card
          [titulo]="'configuracion.secciones.taller' | transloco"
          [subtitulo]="'configuracion.secciones.taller_texto' | transloco"
        >
          <div class="grid gap-5 sm:grid-cols-2">
            <hk-form-field
              class="sm:col-span-2"
              [etiqueta]="'configuracion.campos.nombre' | transloco"
            >
              <hk-input
                formControlName="nombre"
                autocompletar="organization"
                [maxCaracteres]="120"
              />
            </hk-form-field>
            <hk-form-field [etiqueta]="'configuracion.campos.nit' | transloco" [ayuda]="ayudaNit()">
              <hk-input formControlName="nit" modoTeclado="numeric" [maxCaracteres]="20" />
            </hk-form-field>
            <hk-form-field [etiqueta]="'configuracion.campos.telefono' | transloco">
              <hk-input formControlName="telefono" tipo="tel" autocompletar="tel" />
            </hk-form-field>
            <hk-form-field
              class="sm:col-span-2"
              [etiqueta]="'configuracion.campos.direccion' | transloco"
            >
              <hk-input
                formControlName="direccion"
                autocompletar="street-address"
                [maxCaracteres]="200"
              />
            </hk-form-field>
            <hk-form-field
              class="sm:col-span-2"
              [etiqueta]="'configuracion.campos.email' | transloco"
              [opcional]="true"
            >
              <hk-input formControlName="email" tipo="email" autocompletar="email" />
            </hk-form-field>
          </div>
        </hk-card>

        <hk-card [titulo]="'configuracion.secciones.impuestos' | transloco">
          <hk-form-field
            class="max-w-xs"
            [etiqueta]="'configuracion.campos.iva' | transloco"
            [ayuda]="'configuracion.iva_ayuda' | transloco"
          >
            <hk-input formControlName="ivaPorcentaje" modoTeclado="decimal" [maxCaracteres]="6" />
          </hk-form-field>
        </hk-card>

        <hk-card
          [titulo]="'configuracion.secciones.privacidad' | transloco"
          [subtitulo]="'configuracion.secciones.privacidad_texto' | transloco"
        >
          <hk-form-field [etiqueta]="'configuracion.campos.autorizacion' | transloco">
            <hk-textarea
              formControlName="textoAutorizacionDatos"
              [filas]="8"
              [maxCaracteres]="4000"
            />
          </hk-form-field>
        </hk-card>

        <hk-card [titulo]="'configuracion.secciones.alertas' | transloco">
          <hk-switch formControlName="alertaStockHabilitada">
            <span class="block text-sm font-medium text-fg">{{
              'configuracion.campos.alerta_stock' | transloco
            }}</span>
            <span class="block text-xs text-muted">{{
              'configuracion.alerta_stock_ayuda' | transloco
            }}</span>
          </hk-switch>
        </hk-card>
      </form>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguracionPage {
  private readonly api = inject(ConfiguracionApiService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly config = rxResource({
    stream: () => this.api.obtener(erroresManejados()),
  });
  protected readonly guardando = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    nit: ['', [Validators.required, documentoSegunTipo(() => 'NIT')]],
    direccion: ['', [Validators.required, Validators.maxLength(200)]],
    telefono: ['', [Validators.required, telefonoColombiano]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    ivaPorcentaje: [
      '',
      [Validators.required, Validators.pattern(PATRON_PORCENTAJE), Validators.max(100)],
    ],
    textoAutorizacionDatos: ['', [Validators.required, Validators.maxLength(4000)]],
    alertaStockHabilitada: [true],
  });

  /** Hay cambios sin guardar. */
  protected readonly modificado = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.dirty)),
    { initialValue: false },
  );

  private readonly traducciones = toSignal(this.transloco.selectTranslation());
  private readonly nitEscrito = toSignal(this.form.controls.nit.valueChanges, {
    initialValue: '',
  });
  /** Con 9 dígitos se muestra el DV que se agregará al guardar. */
  protected readonly ayudaNit = computed(() => {
    this.traducciones();
    const digitos = normalizarDocumento(this.nitEscrito() ?? '');
    const dv = digitos.length === DIGITOS_NIT ? digitoVerificacionNit(digitos) : null;
    return dv === null
      ? this.transloco.translate('configuracion.nit_ayuda')
      : this.transloco.translate('configuracion.nit_dv', { dv });
  });

  constructor() {
    // Carga los valores guardados (también tras guardar, con los que devuelve el backend)
    effect(() => {
      if (this.config.hasValue()) this.cargar(this.config.value());
    });
  }

  private cargar(c: ConfiguracionTaller): void {
    this.form.reset({
      nombre: c.nombre,
      nit: documentoParaMostrar('NIT', c.nit),
      direccion: c.direccion,
      telefono: c.telefono,
      email: c.email ?? '',
      ivaPorcentaje: `${c.ivaPorcentaje}`,
      textoAutorizacionDatos: c.textoAutorizacionDatos,
      alertaStockHabilitada: c.alertaStockHabilitada,
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
    const datos: ConfiguracionTaller = {
      nombre: v.nombre.trim(),
      nit: documentoParaMostrar('NIT', numeroConDv('NIT', v.nit)),
      direccion: v.direccion.trim(),
      telefono: v.telefono.trim(),
      email: v.email.trim() || null,
      ivaPorcentaje: aPorcentaje(v.ivaPorcentaje) ?? 0,
      textoAutorizacionDatos: v.textoAutorizacionDatos.trim(),
      alertaStockHabilitada: v.alertaStockHabilitada,
    };
    this.guardando.set(true);
    this.api
      .actualizar(datos, conFormulario(this.form))
      .pipe(finalize(() => this.guardando.set(false)))
      .subscribe({
        next: (guardada) => {
          this.config.set(guardada);
          this.toast.exito(this.transloco.translate('configuracion.guardada'));
        },
        error: () => enfocarPrimerError(this.host.nativeElement, this.injector),
      });
  }
}
