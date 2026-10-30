import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';

import { routes } from './app.routes';
import { provideI18n } from './core/i18n/i18n.providers';
import { TituloStrategy } from './core/layout/titulo.strategy';
import { provideIconos } from './shared/ui/iconos';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(withFetch()),
    provideI18n(),
    provideIconos(),
    { provide: TitleStrategy, useClass: TituloStrategy },
  ],
};
