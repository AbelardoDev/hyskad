package com.hyskad.notificaciones.domain;

/**
 * Tipos de notificación interna (BUSINESS-RULES §9). Cada tipo tiene sus claves de i18n en el
 * frontend: {@code notificaciones.tipos.<TIPO>.titulo} y {@code .mensaje}, con los parámetros que
 * guarda la notificación.
 */
public enum TipoNotificacion {
    ORDEN_CREADA,
    MECANICO_ASIGNADO,
    ESTADO_ORDEN_CAMBIADO,
    PRESUPUESTO_ENVIADO,
    PRESUPUESTO_APROBADO,
    PRESUPUESTO_RECHAZADO,
    ORDEN_FINALIZADA,
    ORDEN_ENTREGADA,
    STOCK_BAJO,
    VENTA_ANULADA;

    public String tituloClave() {
        return "notificaciones.tipos." + name() + ".titulo";
    }

    public String mensajeClave() {
        return "notificaciones.tipos." + name() + ".mensaje";
    }
}
