/** Permisos del backend (ARCHITECTURE §5) que usa el menú. */
export type Permiso =
  | 'DASHBOARD_VER'
  | 'ORDENES_VER_TODAS'
  | 'ORDENES_VER_ASIGNADAS'
  | 'CLIENTES_VER'
  | 'MOTOS_VER'
  | 'SERVICIOS_GESTIONAR'
  | 'VENTAS_VER'
  | 'PRODUCTOS_VER'
  | 'COMPRAS_GESTIONAR'
  | 'PROVEEDORES_GESTIONAR'
  | 'REPORTES_VER'
  | 'USUARIOS_GESTIONAR'
  | 'CONFIGURACION_GESTIONAR';

export interface ItemMenuNavegacion {
  /** Clave i18n del texto (`menu.*`). */
  clave: string;
  /** Texto corto para la barra inferior en móvil, si el normal no cabe. */
  claveCorta?: string;
  icono: string;
  ruta: string;
  /** Basta con tener uno de estos permisos para ver el ítem (el filtrado llega en F04B). */
  permisos: readonly Permiso[];
  /** Aparece en la barra inferior en móvil (máximo 4). */
  accesoRapido?: boolean;
}

export interface GrupoMenu {
  clave: string;
  items: readonly ItemMenuNavegacion[];
}

/** Menú lateral: de aquí salen el sidebar, el drawer móvil y la barra inferior. */
export const MENU: readonly GrupoMenu[] = [
  {
    clave: 'menu.grupos.general',
    items: [
      {
        clave: 'menu.dashboard',
        icono: 'layout-dashboard',
        ruta: '/dashboard',
        permisos: ['DASHBOARD_VER'],
        accesoRapido: true,
      },
    ],
  },
  {
    clave: 'menu.grupos.taller',
    items: [
      {
        clave: 'menu.ordenes',
        claveCorta: 'menu.ordenes_corto',
        icono: 'wrench',
        ruta: '/ordenes',
        permisos: ['ORDENES_VER_TODAS', 'ORDENES_VER_ASIGNADAS'],
        accesoRapido: true,
      },
      {
        clave: 'menu.clientes',
        icono: 'users-round',
        ruta: '/clientes',
        permisos: ['CLIENTES_VER'],
        accesoRapido: true,
      },
      { clave: 'menu.motocicletas', icono: 'bike', ruta: '/motocicletas', permisos: ['MOTOS_VER'] },
      {
        clave: 'menu.servicios',
        icono: 'clipboard-list',
        ruta: '/servicios',
        permisos: ['SERVICIOS_GESTIONAR'],
      },
    ],
  },
  {
    clave: 'menu.grupos.comercial',
    items: [
      {
        clave: 'menu.ventas',
        icono: 'shopping-cart',
        ruta: '/ventas',
        permisos: ['VENTAS_VER'],
        accesoRapido: true,
      },
      {
        clave: 'menu.inventario',
        icono: 'package',
        ruta: '/inventario',
        permisos: ['PRODUCTOS_VER'],
      },
      { clave: 'menu.compras', icono: 'truck', ruta: '/compras', permisos: ['COMPRAS_GESTIONAR'] },
      {
        clave: 'menu.proveedores',
        icono: 'building',
        ruta: '/proveedores',
        permisos: ['PROVEEDORES_GESTIONAR'],
      },
    ],
  },
  {
    clave: 'menu.grupos.administracion',
    items: [
      {
        clave: 'menu.reportes',
        icono: 'chart-column',
        ruta: '/reportes',
        permisos: ['REPORTES_VER'],
      },
      {
        clave: 'menu.usuarios',
        icono: 'shield-user',
        ruta: '/usuarios',
        permisos: ['USUARIOS_GESTIONAR'],
      },
      {
        clave: 'menu.configuracion',
        icono: 'settings',
        ruta: '/configuracion',
        permisos: ['CONFIGURACION_GESTIONAR'],
      },
    ],
  },
];

export const ACCESOS_RAPIDOS: readonly ItemMenuNavegacion[] = MENU.flatMap((g) => g.items).filter(
  (i) => i.accesoRapido,
);
