import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from './auth.service';
import { iniciarSesionDePrueba, sesionDePrueba } from './sesion-de-prueba';
import { HkTienePermisoDirective } from './tiene-permiso.directive';

@Component({
  imports: [HkTienePermisoDirective],
  template: `
    <button id="crear" *hkTienePermiso="'VENTAS_CREAR'">Nueva venta</button>
    <button id="alguno" *hkTienePermiso="['VENTAS_ANULAR', 'VENTAS_VER']">Ver</button>
  `,
})
class Anfitrion {}

describe('*hkTienePermiso', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  function montar() {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return fixture;
  }

  it('sin sesión no muestra nada', () => {
    const el = montar().nativeElement as HTMLElement;
    expect(el.querySelector('#crear')).toBeNull();
    expect(el.querySelector('#alguno')).toBeNull();
  });

  it('muestra el contenido con el permiso o con alguno de la lista', () => {
    iniciarSesionDePrueba({ permisos: ['VENTAS_VER'] });
    const el = montar().nativeElement as HTMLElement;
    expect(el.querySelector('#crear')).toBeNull();
    expect(el.querySelector('#alguno')?.textContent).toBe('Ver');
  });

  it('reacciona cuando cambian los permisos de la sesión', () => {
    iniciarSesionDePrueba({ permisos: ['VENTAS_CREAR'] });
    const fixture = montar();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#crear')).not.toBeNull();

    TestBed.inject(AuthService).refrescar().subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/refresh')
      .flush(sesionDePrueba({ permisos: [] }));
    fixture.detectChanges();

    expect(el.querySelector('#crear')).toBeNull();
  });
});
