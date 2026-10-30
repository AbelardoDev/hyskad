import { Routes } from '@angular/router';

import { permisoGuard } from '../../core/auth/guards';
import { AccionProximamente, ProximamentePage } from '../../core/layout/paginas/proximamente-page';

const NUEVA_VENTA: AccionProximamente = {
  clave: 'ventas.nueva',
  icono: 'plus',
  ruta: '/ventas/nueva',
  permiso: 'VENTAS_CREAR',
};

export const VENTAS_ROUTES: Routes = [
  { path: '', component: ProximamentePage, data: { icono: 'shopping-cart', accion: NUEVA_VENTA } },
  {
    path: 'nueva',
    canMatch: [permisoGuard('VENTAS_CREAR')],
    component: ProximamentePage,
    data: { miga: 'ventas.nueva', icono: 'shopping-cart' },
  },
];
