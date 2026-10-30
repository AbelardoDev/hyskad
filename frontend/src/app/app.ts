import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { LanguageService } from './core/i18n/language.service';
import { ThemeService } from './core/theme/theme.service';
import { HkToast } from './shared/ui/toast/toast';

@Component({
  selector: 'hk-root',
  imports: [RouterOutlet, HkToast],
  template: '<router-outlet /><hk-toast />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    // Se instancian al arrancar para aplicar tema e idioma guardados y seguir sus cambios.
    inject(ThemeService);
    inject(LanguageService);
  }
}
