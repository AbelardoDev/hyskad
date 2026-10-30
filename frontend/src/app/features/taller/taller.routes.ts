import { Routes } from '@angular/router';

import { ProximamentePage } from '../../core/layout/paginas/proximamente-page';

export const TALLER_ROUTES: Routes = [
  { path: '', component: ProximamentePage, data: { icono: 'wrench' } },
];
