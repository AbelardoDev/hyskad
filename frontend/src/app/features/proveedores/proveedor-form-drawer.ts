import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize, Observable } from 'rxjs';

import { conFormulario, marcarErroresServidor } from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import {
  documentoSegunTipo,
  normalizarTelefono,
  numeroConDv,
  telefonoColombiano,
  TipoDocumento,
} from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { HkDrawer } from '../../shared/ui/dialog/drawer';
import { HkCamposDocumento } from '../../shared/ui/forms/campos-documento';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { DatosProveedor, Proveedor, ProveedoresApiService } from './proveedores-api.service';

export interface DatosFormProveedor {
  /** Si viene, se edita; si no, se crea. */
  proveedor?: Proveedor;
}

/** Crear o editar un proveedor (RF20). Normalmente con NIT: el DV se calcula en vivo. */
@Component({
  selector: 'hk-proveedor-form-drawer',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkButton,
    HkCamposDocumento,
    HkDrawer,
    HkFormField,
    HkInput,
  ],
  template: `
    <hk-drawer
      [titulo]="
        (proveedor ? 'proveedores.form.titulo_editar' : 'proveedores.form.titulo_nuevo') | transloco
      "
    >
      <form
        id="form-proveedor"
        class="space-y-5"
        [formGroup]="form"
        (ngSubmit)="guardar()"
        novalidate
      >
        <hk-campos-documento
          [tipoDocumento]="form.controls.tipoDocumento"
          [numeroDocumento]="form.controls.numeroDocumento"
        />
        <hk-form-field [etiqueta]="'proveedores.campos.razon_social' | transloco">
          <hk-input
            formControlName="razonSocial"
            autocompletar="organization"
            [maxCaracteres]="150"
          />
        </hk-form-field>
        <div class="grid gap-5 sm:grid-cols-2">
          <hk-form-field [etiqueta]="'proveedores.campos.contacto' | transloco" [opcional]="true">
            <hk-input formControlName="contacto" autocompletar="off" [maxCaracteres]="120" />
          </hk-form-field>
          <hk-form-field
            [etiqueta]="'proveedores.campos.telefono' | transloco"
            [ayuda]="'proveedores.form.telefono_ayuda' | transloco"
            [opcional]="true"
          >
            <hk-input
              formControlName="telefono"
              tipo="tel"
              modoTeclado="tel"
              [maxCaracteres]="20"
            />
          </hk-form-field>
        </div>
        <hk-form-field [etiqueta]="'proveedores.campos.email' | transloco" [opcional]="true">
          <hk-input
            formControlName="email"
            tipo="email"
            modoTeclado="email"
            autocompletar="off"
            [maxCaracteres]="254"
          />
        </hk-form-field>
        <hk-form-field [etiqueta]="'proveedores.campos.direccion' | transloco" [opcional]="true">
          <hk-input formControlName="direccion" autocompletar="off" [maxCaracteres]="200" />
        </hk-form-field>
      </form>
      <div hkDrawerPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button
          hk-button
          tipo="submit"
          form="form-proveedor"
          icono="check"
          [cargando]="guardando()"
        >
          {{ 'comun.guardar' | transloco }}
        </button>
      </div>
    </hk-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProveedorFormDrawer {
  private readonly api = inject(ProveedoresApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Proveedor>>(DialogRef);
  protected readonly proveedor = inject<DatosFormProveedor | undefined>(DIALOG_DATA)?.proveedor;
  protected readonly guardando = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    tipoDocumento: [
      (this.proveedor?.tipoDocumento ?? 'NIT') as TipoDocumento | '',
      Validators.required,
    ],
    numeroDocumento: [this.proveedor?.numeroDocumento ?? '', Validators.required],
    razonSocial: [
      this.proveedor?.razonSocial ?? '',
      [Validators.required, Validators.maxLength(150)],
    ],
    contacto: [this.proveedor?.contacto ?? '', Validators.maxLength(120)],
    telefono: [this.proveedor?.telefono ?? '', telefonoColombiano],
    email: [this.proveedor?.email ?? '', [Validators.email, Validators.maxLength(254)]],
    direccion: [this.proveedor?.direccion ?? '', Validators.maxLength(200)],
  });

  constructor() {
    const { numeroDocumento, tipoDocumento } = this.form.controls;
    numeroDocumento.addValidators(documentoSegunTipo(() => tipoDocumento.value));
    numeroDocumento.updateValueAndValidity();
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const v = this.form.getRawValue();
    if (!v.tipoDocumento) return;
    const datos: DatosProveedor = {
      tipoDocumento: v.tipoDocumento,
      numeroDocumento: numeroConDv(v.tipoDocumento, v.numeroDocumento),
      razonSocial: v.razonSocial.trim(),
      contacto: v.contacto.trim() || null,
      telefono: v.telefono.trim() ? normalizarTelefono(v.telefono) : null,
      email: v.email.trim() || null,
      direccion: v.direccion.trim() || null,
    };
    const contexto = conFormulario(this.form);
    const peticion: Observable<Proveedor> = this.proveedor
      ? this.api.actualizar(this.proveedor.id, datos, contexto)
      : this.api.crear(datos, contexto);
    this.guardando.set(true);
    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (guardado) => this.ref.close(guardado),
      error: (e: HttpErrorResponse) => {
        if (codigoDeError(e) === 'DOCUMENTO_DUPLICADO')
          marcarErroresServidor(this.form, [
            { campo: 'numeroDocumento', code: 'DOCUMENTO_DUPLICADO' },
          ]);
        enfocarPrimerError(this.host.nativeElement, this.injector);
      },
    });
  }
}
