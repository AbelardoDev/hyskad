package com.hyskad.usuarios.domain;

/**
 * Permisos del sistema (ARCHITECTURE.md §5). Viajan en el JWT como authorities sin prefijo y se
 * verifican con {@code hasAuthority("...")}. Los marcados como solo admin no se pueden conceder a
 * usuarios de otros roles.
 */
public enum Permiso {
    DASHBOARD_VER,
    USUARIOS_GESTIONAR(true),
    CONFIGURACION_GESTIONAR(true),
    AUDITORIA_VER(true),
    CLIENTES_VER,
    CLIENTES_GESTIONAR,
    MOTOS_VER,
    MOTOS_GESTIONAR,
    PRODUCTOS_VER,
    PRODUCTOS_GESTIONAR,
    INVENTARIO_AJUSTAR,
    PROVEEDORES_GESTIONAR,
    COMPRAS_GESTIONAR,
    VENTAS_VER,
    VENTAS_CREAR,
    VENTAS_ANULAR,
    SERVICIOS_GESTIONAR,
    ORDENES_VER_TODAS,
    ORDENES_VER_ASIGNADAS,
    ORDENES_CREAR,
    ORDENES_ASIGNAR,
    ORDENES_TRABAJAR,
    PRESUPUESTOS_GESTIONAR,
    PAGOS_REGISTRAR,
    ENTREGAS_REGISTRAR,
    REPORTES_VER;

    private final boolean soloAdmin;

    Permiso() {
        this(false);
    }

    Permiso(boolean soloAdmin) {
        this.soloAdmin = soloAdmin;
    }

    public boolean isSoloAdmin() {
        return soloAdmin;
    }
}
