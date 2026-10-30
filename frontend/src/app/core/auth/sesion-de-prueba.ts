import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SesionResponse, UsuarioSesion } from './auth.models';
import { AuthService } from './auth.service';
import { PERMISOS } from './permisos';

/** Usuario de prueba (admin con todos los permisos salvo lo que se sobrescriba). */
export function usuarioDePrueba(cambios: Partial<UsuarioSesion> = {}): UsuarioSesion {
  return {
    id: 1,
    nombre: 'Ana Admin',
    email: 'ana@hyskad.test',
    rol: 'ADMIN',
    permisos: [...PERMISOS],
    idioma: 'es',
    debeCambiarPassword: false,
    ...cambios,
  };
}

export function sesionDePrueba(
  cambios: Partial<UsuarioSesion> = {},
  token = 'token-1',
  expiresIn = 900,
): SesionResponse {
  return { accessToken: token, expiresIn, usuario: usuarioDePrueba(cambios) };
}

/**
 * Inicia sesión con el `AuthService` real respondiendo el login con `HttpTestingController`
 * (requiere `provideHttpClient()` y `provideHttpClientTesting()` en el TestBed).
 */
export function iniciarSesionDePrueba(cambios: Partial<UsuarioSesion> = {}): UsuarioSesion {
  const auth = TestBed.inject(AuthService);
  auth.login('ana@hyskad.test', 'Clave12345').subscribe();
  TestBed.inject(HttpTestingController)
    .expectOne('/api/v1/auth/login')
    .flush(sesionDePrueba(cambios));
  return auth.usuario()!;
}
