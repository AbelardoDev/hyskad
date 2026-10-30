import { inject, Pipe, PipeTransform } from '@angular/core';

import { LanguageService } from '../i18n/language.service';
import { EstiloFecha, formatoCop, formatoFecha, Monto, tiempoRelativo } from './formato';

// Las tres pipes son impuras para reaccionar al cambio de idioma; el costo es bajo
// porque los formateadores de Intl se reutilizan por locale.

/** `{{ total | cop }}` → "$ 1.250.000" */
@Pipe({ name: 'cop', pure: false })
export class CopPipe implements PipeTransform {
  private readonly idioma = inject(LanguageService);

  transform(valor: Monto): string {
    return formatoCop(valor, this.idioma.locale());
  }
}

/** `{{ creadoEn | tiempoRelativo }}` → "hace 5 min" */
@Pipe({ name: 'tiempoRelativo', pure: false })
export class TiempoRelativoPipe implements PipeTransform {
  private readonly idioma = inject(LanguageService);

  transform(valor: Date | string | number | null | undefined): string {
    return valor === null || valor === undefined ? '' : tiempoRelativo(valor, this.idioma.locale());
  }
}

/** `{{ fecha | fecha: 'fechaHora' }}` */
@Pipe({ name: 'fecha', pure: false })
export class FechaPipe implements PipeTransform {
  private readonly idioma = inject(LanguageService);

  transform(
    valor: Date | string | number | null | undefined,
    estilo: EstiloFecha = 'media',
  ): string {
    return valor === null || valor === undefined
      ? ''
      : formatoFecha(valor, this.idioma.locale(), estilo);
  }
}
