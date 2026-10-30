/** Permisos del backend (ARCHITECTURE §5), en el mismo orden que el enum `Permiso`. */
export const PERMISOS = [
  'DASHBOARD_VER',
  'USUARIOS_GESTIONAR',
  'CONFIGURACION_GESTIONAR',
  'AUDITORIA_VER',
  'CLIENTES_VER',
  'CLIENTES_GESTIONAR',
  'MOTOS_VER',
  'MOTOS_GESTIONAR',
  'PRODUCTOS_VER',
  'PRODUCTOS_GESTIONAR',
  'INVENTARIO_AJUSTAR',
  'PROVEEDORES_GESTIONAR',
  'COMPRAS_GESTIONAR',
  'VENTAS_VER',
  'VENTAS_CREAR',
  'VENTAS_ANULAR',
  'SERVICIOS_GESTIONAR',
  'ORDENES_VER_TODAS',
  'ORDENES_VER_ASIGNADAS',
  'ORDENES_CREAR',
  'ORDENES_ASIGNAR',
  'ORDENES_TRABAJAR',
  'PRESUPUESTOS_GESTIONAR',
  'PAGOS_REGISTRAR',
  'ENTREGAS_REGISTRAR',
  'REPORTES_VER',
] as const;

export type Permiso = (typeof PERMISOS)[number];

export const ROLES = ['ADMIN', 'ALMACEN', 'VENDEDOR', 'MECANICO'] as const;

export type Rol = (typeof ROLES)[number];

/** Módulos en los que se agrupan los permisos en la pantalla de permisos de un usuario. */
export const MODULOS_PERMISOS: readonly { clave: string; permisos: readonly Permiso[] }[] = [
  { clave: 'general', permisos: ['DASHBOARD_VER', 'REPORTES_VER'] },
  {
    clave: 'clientes',
    permisos: ['CLIENTES_VER', 'CLIENTES_GESTIONAR', 'MOTOS_VER', 'MOTOS_GESTIONAR'],
  },
  {
    clave: 'taller',
    permisos: [
      'SERVICIOS_GESTIONAR',
      'ORDENES_VER_TODAS',
      'ORDENES_VER_ASIGNADAS',
      'ORDENES_CREAR',
      'ORDENES_ASIGNAR',
      'ORDENES_TRABAJAR',
      'PRESUPUESTOS_GESTIONAR',
      'PAGOS_REGISTRAR',
      'ENTREGAS_REGISTRAR',
    ],
  },
  { clave: 'ventas', permisos: ['VENTAS_VER', 'VENTAS_CREAR', 'VENTAS_ANULAR'] },
  {
    clave: 'inventario',
    permisos: [
      'PRODUCTOS_VER',
      'PRODUCTOS_GESTIONAR',
      'INVENTARIO_AJUSTAR',
      'PROVEEDORES_GESTIONAR',
      'COMPRAS_GESTIONAR',
    ],
  },
  {
    clave: 'administracion',
    permisos: ['USUARIOS_GESTIONAR', 'CONFIGURACION_GESTIONAR', 'AUDITORIA_VER'],
  },
];
