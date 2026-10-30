import { Routes } from '@angular/router';

import { ProximamentePage } from '../../core/layout/paginas/proximamente-page';

export const INVENTARIO_ROUTES: Routes = [
  { path: '', component: ProximamentePage, data: { icono: 'package' } },
];
