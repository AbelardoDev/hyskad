import { Idioma } from '../i18n/language.service';
import { Rol } from './permisos';

/** Usuario autenticado tal como lo devuelve el backend (`UsuarioSesion`). */
export interface UsuarioSesion {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  /** Permisos efectivos (rol + ajustes). */
  permisos: string[];
  idioma: Idioma;
  debeCambiarPassword: boolean;
}

/** Respuesta de login y refresh. El refresh token viaja solo en la cookie `HttpOnly`. */
export interface SesionResponse {
  accessToken: string;
  /** Segundos de vigencia del access token. */
  expiresIn: number;
  usuario: UsuarioSesion;
}
