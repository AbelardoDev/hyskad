import { EnvironmentProviders, importProvidersFrom, Provider } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';

import en from '../public/i18n/en.json';
import es from '../public/i18n/es.json';
import { provideIconos } from './app/shared/ui/iconos';

/** Proveedores comunes de todas las pruebas: Transloco con los textos reales (es/en) e íconos. */
const providers: (Provider | EnvironmentProviders)[] = [
  importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: { es, en },
      translocoConfig: { availableLangs: ['es', 'en'], defaultLang: 'es' },
      preloadLangs: true,
    }),
  ),
  provideIconos(),
];

export default providers;
