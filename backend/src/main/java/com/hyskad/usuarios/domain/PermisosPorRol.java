package com.hyskad.usuarios.domain;

import static com.hyskad.usuarios.domain.Permiso.CLIENTES_GESTIONAR;
import static com.hyskad.usuarios.domain.Permiso.CLIENTES_VER;
import static com.hyskad.usuarios.domain.Permiso.COMPRAS_GESTIONAR;
import static com.hyskad.usuarios.domain.Permiso.DASHBOARD_VER;
import static com.hyskad.usuarios.domain.Permiso.ENTREGAS_REGISTRAR;
import static com.hyskad.usuarios.domain.Permiso.INVENTARIO_AJUSTAR;
import static com.hyskad.usuarios.domain.Permiso.MOTOS_GESTIONAR;
import static com.hyskad.usuarios.domain.Permiso.MOTOS_VER;
import static com.hyskad.usuarios.domain.Permiso.ORDENES_ASIGNAR;
import static com.hyskad.usuarios.domain.Permiso.ORDENES_CREAR;
import static com.hyskad.usuarios.domain.Permiso.ORDENES_TRABAJAR;
import static com.hyskad.usuarios.domain.Permiso.ORDENES_VER_ASIGNADAS;
import static com.hyskad.usuarios.domain.Permiso.ORDENES_VER_TODAS;
import static com.hyskad.usuarios.domain.Permiso.PAGOS_REGISTRAR;
import static com.hyskad.usuarios.domain.Permiso.PRESUPUESTOS_GESTIONAR;
import static com.hyskad.usuarios.domain.Permiso.PRODUCTOS_GESTIONAR;
import static com.hyskad.usuarios.domain.Permiso.PRODUCTOS_VER;
import static com.hyskad.usuarios.domain.Permiso.PROVEEDORES_GESTIONAR;
import static com.hyskad.usuarios.domain.Permiso.REPORTES_VER;
import static com.hyskad.usuarios.domain.Permiso.VENTAS_CREAR;
import static com.hyskad.usuarios.domain.Permiso.VENTAS_VER;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Permisos por defecto de cada rol, copia exacta de la tabla de ARCHITECTURE.md §5. Vive en código
 * (no en BD); {@code usuario_permiso} guarda solo las excepciones de cada usuario.
 */
public final class PermisosPorRol {

    public static final Map<Rol, Set<Permiso>> PERMISOS_POR_ROL = Map.of(
            Rol.ADMIN, Set.copyOf(EnumSet.allOf(Permiso.class)),
            Rol.ALMACEN, Set.copyOf(EnumSet.of(
                    DASHBOARD_VER, PRODUCTOS_VER, PRODUCTOS_GESTIONAR, INVENTARIO_AJUSTAR, PROVEEDORES_GESTIONAR,
                    COMPRAS_GESTIONAR, VENTAS_VER, ORDENES_VER_TODAS, REPORTES_VER)),
            Rol.VENDEDOR, Set.copyOf(EnumSet.of(
                    DASHBOARD_VER, CLIENTES_VER, CLIENTES_GESTIONAR, MOTOS_VER, MOTOS_GESTIONAR, PRODUCTOS_VER,
                    VENTAS_VER, VENTAS_CREAR, ORDENES_VER_TODAS, ORDENES_CREAR, ORDENES_ASIGNAR, ORDENES_TRABAJAR,
                    PRESUPUESTOS_GESTIONAR, PAGOS_REGISTRAR, ENTREGAS_REGISTRAR, REPORTES_VER)),
            Rol.MECANICO, Set.copyOf(EnumSet.of(
                    DASHBOARD_VER, CLIENTES_VER, MOTOS_VER, PRODUCTOS_VER, ORDENES_VER_ASIGNADAS, ORDENES_TRABAJAR)));

    private PermisosPorRol() {
    }

    public static Set<Permiso> de(Rol rol) {
        return PERMISOS_POR_ROL.get(rol);
    }
}
