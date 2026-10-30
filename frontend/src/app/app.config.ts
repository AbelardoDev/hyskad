import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { errorInterceptor } from './core/http/error.interceptor';
import { provideI18n } from './core/i18n/i18n.providers';
import { TituloStrategy } from './core/layout/titulo.strategy';
import { provideIconos } from './shared/ui/iconos';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    // El de errores va por fuera: un 401 que el de auth resuelve con refresh no llega a toast.
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor, authInterceptor])),
    // Recupera la sesión con la cookie de refresh antes de la primera navegación (splash en index.html).
    provideAppInitializer(() => inject(AuthService).restaurar()),
    provideI18n(),
    provideIconos(),
    { provide: TitleStrategy, useClass: TituloStrategy },
  ],
};
