import { Routes } from '@angular/router';

import { ProximamentePage } from '../../core/layout/paginas/proximamente-page';

export const CONFIGURACION_ROUTES: Routes = [
  { path: '', component: ProximamentePage, data: { icono: 'settings' } },
];
