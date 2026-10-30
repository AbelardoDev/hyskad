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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { translateSignal, TranslocoPipe } from '@jsverse/transloco';
import { finalize, Observable } from 'rxjs';

import { Rol, ROLES } from '../../core/auth/permisos';
import { conFormulario, marcarErroresServidor } from '../../core/http/contexto-http';
import { codigoDeError } from '../../core/http/error.interceptor';
import { Idioma, IDIOMAS } from '../../core/i18n/language.service';
import { passwordSegura, PATRON_TELEFONO } from '../../core/utils/validadores';
import { HkButton } from '../../shared/ui/button/button';
import { HkDrawer } from '../../shared/ui/dialog/drawer';
import { enfocarPrimerError } from '../../shared/ui/forms/enfocar-error';
import { HkFormField } from '../../shared/ui/forms/form-field';
import { HkInput } from '../../shared/ui/forms/input';
import { HkMedidorPassword } from '../../shared/ui/forms/medidor-password';
import { HkSelect, OpcionSelect } from '../../shared/ui/forms/select';
import { Usuario, UsuariosApiService } from './usuarios-api.service';

export interface DatosFormUsuario {
  /** Si viene, se edita; si no, se crea. */
  usuario?: Usuario;
}

/** Crear o editar un usuario (RF1, RF3) en un drawer. Cierra devolviendo el usuario guardado. */
@Component({
  selector: 'hk-usuario-form-drawer',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HkButton,
    HkDrawer,
    HkFormField,
    HkInput,
    HkMedidorPassword,
    HkSelect,
  ],
  template: `
    <hk-drawer
      [titulo]="
        (esNuevo ? 'usuarios.form.titulo_nuevo' : 'usuarios.form.titulo_editar') | transloco
      "
    >
      <form
        id="form-usuario"
        class="space-y-5"
        [formGroup]="form"
        (ngSubmit)="guardar()"
        novalidate
      >
        <hk-form-field [etiqueta]="'usuarios.campos.nombre' | transloco">
          <hk-input formControlName="nombre" autocompletar="off" [maxCaracteres]="120" />
        </hk-form-field>
        <hk-form-field [etiqueta]="'usuarios.campos.email' | transloco">
          <hk-input
            formControlName="email"
            tipo="email"
            autocompletar="off"
            modoTeclado="email"
            [maxCaracteres]="254"
          />
        </hk-form-field>
        <hk-form-field
          [etiqueta]="'usuarios.campos.telefono' | transloco"
          [ayuda]="'usuarios.form.telefono_ayuda' | transloco"
          [opcional]="true"
        >
          <hk-input formControlName="telefono" tipo="tel" modoTeclado="tel" [maxCaracteres]="20" />
        </hk-form-field>
        <hk-form-field
          [etiqueta]="'usuarios.campos.rol' | transloco"
          [ayuda]="'usuarios.form.rol_ayuda' | transloco"
        >
          <hk-select
            formControlName="rol"
            [opciones]="opcionesRol()"
            [placeholder]="'usuarios.form.elige_rol' | transloco"
          />
        </hk-form-field>
        @if (esNuevo) {
          <hk-form-field [etiqueta]="'usuarios.campos.idioma' | transloco">
            <hk-select formControlName="idioma" [opciones]="opcionesIdioma()" />
          </hk-form-field>
          <div>
            <hk-form-field
              [etiqueta]="'usuarios.campos.password' | transloco"
              [ayuda]="'usuarios.form.password_ayuda' | transloco"
            >
              <hk-input
                formControlName="password"
                tipo="password"
                autocompletar="new-password"
                [maxCaracteres]="72"
              />
            </hk-form-field>
            <hk-medidor-password [valor]="form.controls.password.value" />
          </div>
        }
      </form>
      <div hkDrawerPie class="contents">
        <button hk-button variante="secondary" (click)="ref.close()">
          {{ 'comun.cancelar' | transloco }}
        </button>
        <button hk-button tipo="submit" form="form-usuario" icono="save" [cargando]="guardando()">
          {{ 'comun.guardar' | transloco }}
        </button>
      </div>
    </hk-drawer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuarioFormDrawer {
  private readonly api = inject(UsuariosApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly ref = inject<DialogRef<Usuario>>(DialogRef);
  private readonly usuario = inject<DatosFormUsuario | undefined>(DIALOG_DATA)?.usuario;

  protected readonly esNuevo = !this.usuario;
  protected readonly guardando = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: [this.usuario?.nombre ?? '', [Validators.required, Validators.maxLength(120)]],
    email: [
      this.usuario?.email ?? '',
      [Validators.required, Validators.email, Validators.maxLength(254)],
    ],
    telefono: [
      this.usuario?.telefono ?? '',
      [Validators.maxLength(20), Validators.pattern(PATRON_TELEFONO)],
    ],
    rol: [(this.usuario?.rol ?? '') as Rol | '', Validators.required],
    idioma: [{ value: 'es' as Idioma, disabled: !this.esNuevo }],
    password: [{ value: '', disabled: !this.esNuevo }, [Validators.required, passwordSegura]],
  });

  private readonly textosRol = translateSignal(ROLES.map((r) => `roles.${r}`));
  private readonly textosIdioma = translateSignal(IDIOMAS.map((i) => `idiomas.${i}`));
  protected readonly opcionesRol = computed<OpcionSelect[]>(() =>
    ROLES.map((valor, i) => ({ valor, etiqueta: this.textosRol()[i] })),
  );
  protected readonly opcionesIdioma = computed<OpcionSelect[]>(() =>
    IDIOMAS.map((valor, i) => ({ valor, etiqueta: this.textosIdioma()[i] })),
  );

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      enfocarPrimerError(this.host.nativeElement, this.injector);
      return;
    }
    const { nombre, email, telefono, rol, idioma, password } = this.form.getRawValue();
    if (!rol) return;
    const datos = {
      nombre: nombre.trim(),
      email: email.trim(),
      telefono: telefono.trim() || null,
      rol,
    };
    const contexto = conFormulario(this.form);
    const peticion: Observable<Usuario> = this.usuario
      ? this.api.actualizar(this.usuario.id, datos, contexto)
      : this.api.crear({ ...datos, idioma, password }, contexto);

    this.guardando.set(true);
    peticion.pipe(finalize(() => this.guardando.set(false))).subscribe({
      next: (guardado) => this.ref.close(guardado),
      error: (e: HttpErrorResponse) => {
        if (codigoDeError(e) === 'EMAIL_DUPLICADO')
          marcarErroresServidor(this.form, [{ campo: 'email', code: 'EMAIL_DUPLICADO' }]);
        enfocarPrimerError(this.host.nativeElement, this.injector);
      },
    });
  }
}
