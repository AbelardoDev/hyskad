import { registerLocaleData } from '@angular/common';
import localeEn from '@angular/common/locales/en';
import localeEsCo from '@angular/common/locales/es-CO';
import {
  EnvironmentProviders,
  isDevMode,
  LOCALE_ID,
  makeEnvironmentProviders,
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';

import { IDIOMA_POR_DEFECTO, IDIOMAS, leerIdiomaGuardado } from './language.service';
import { TranslocoHttpLoader } from './transloco-http-loader';

registerLocaleData(localeEsCo);
registerLocaleData(localeEn);

/**
 * Transloco (es/en, archivos por scope en `public/i18n/<scope>/<idioma>.json`) y la locale
 * de Angular. `LOCALE_ID` se fija al arrancar; los formateadores propios (`cop`, `fecha`,
 * `tiempoRelativo`) siguen el idioma activo sin recargar.
 */
export function provideI18n(): EnvironmentProviders {
  const idioma = leerIdiomaGuardado();
  return makeEnvironmentProviders([
    provideTransloco({
      config: {
        availableLangs: [...IDIOMAS],
        defaultLang: idioma,
        fallbackLang: IDIOMA_POR_DEFECTO,
        reRenderOnLangChange: true,
        missingHandler: { useFallbackTranslation: true, logMissingKey: isDevMode() },
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    { provide: LOCALE_ID, useValue: idioma === 'en' ? 'en-US' : 'es-CO' },
  ]);
}
