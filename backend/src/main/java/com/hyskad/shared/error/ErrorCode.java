package com.hyskad.shared.error;

import org.springframework.http.HttpStatus;

/**
 * Códigos de error estables que viajan en la propiedad {@code code} del ProblemDetail. El
 * frontend los traduce; no se renombran una vez publicados. Cada módulo agrega aquí los suyos.
 */
public enum ErrorCode {

    VALIDACION(HttpStatus.BAD_REQUEST),
    SOLICITUD_MALFORMADA(HttpStatus.BAD_REQUEST),
    PARAMETRO_INVALIDO(HttpStatus.BAD_REQUEST),
    PARAMETRO_REQUERIDO(HttpStatus.BAD_REQUEST),
    NO_AUTENTICADO(HttpStatus.UNAUTHORIZED),
    ACCESO_DENEGADO(HttpStatus.FORBIDDEN),
    RECURSO_NO_ENCONTRADO(HttpStatus.NOT_FOUND),
    RUTA_NO_ENCONTRADA(HttpStatus.NOT_FOUND),
    METODO_NO_PERMITIDO(HttpStatus.METHOD_NOT_ALLOWED),
    TIPO_CONTENIDO_NO_SOPORTADO(HttpStatus.UNSUPPORTED_MEDIA_TYPE),
    CONFLICTO_CONCURRENCIA(HttpStatus.CONFLICT),
    CONFLICTO_DATOS(HttpStatus.CONFLICT),
    DEMASIADAS_SOLICITUDES(HttpStatus.TOO_MANY_REQUESTS),
    // auth
    CREDENCIALES_INVALIDAS(HttpStatus.UNAUTHORIZED),
    SESION_INVALIDA(HttpStatus.UNAUTHORIZED),
    PASSWORD_ACTUAL_INCORRECTA(HttpStatus.BAD_REQUEST),
    TOKEN_INVALIDO(HttpStatus.BAD_REQUEST),
    // usuarios
    EMAIL_DUPLICADO(HttpStatus.CONFLICT),
    ULTIMO_ADMIN(HttpStatus.CONFLICT),
    AUTO_MODIFICACION(HttpStatus.CONFLICT),
    PERMISO_SOLO_ADMIN(HttpStatus.BAD_REQUEST),
    // clientes y motocicletas
    DOCUMENTO_DUPLICADO(HttpStatus.CONFLICT),
    PLACA_DUPLICADA(HttpStatus.CONFLICT),
    VIN_DUPLICADO(HttpStatus.CONFLICT),
    CLIENTE_INACTIVO(HttpStatus.CONFLICT),
    ORDENES_ACTIVAS(HttpStatus.CONFLICT),
    // catálogo e inventario
    CODIGO_DUPLICADO(HttpStatus.CONFLICT),
    CATEGORIA_DUPLICADA(HttpStatus.CONFLICT),
    CATEGORIA_INACTIVA(HttpStatus.CONFLICT),
    PRODUCTO_INACTIVO(HttpStatus.CONFLICT),
    STOCK_INSUFICIENTE(HttpStatus.CONFLICT),
    RESERVA_INSUFICIENTE(HttpStatus.CONFLICT),
    RESERVA_PENDIENTE(HttpStatus.CONFLICT),
    CANTIDAD_INVALIDA(HttpStatus.BAD_REQUEST),
    // proveedores y compras
    PROVEEDOR_INACTIVO(HttpStatus.CONFLICT),
    FACTURA_DUPLICADA(HttpStatus.CONFLICT),
    COMPRA_ANULADA(HttpStatus.CONFLICT),
    // ventas
    VENTA_ANULADA(HttpStatus.CONFLICT),
    // servicios y taller
    SERVICIO_DUPLICADO(HttpStatus.CONFLICT),
    MOTO_NO_PERTENECE_CLIENTE(HttpStatus.BAD_REQUEST),
    MOTO_INACTIVA(HttpStatus.CONFLICT),
    MOTO_CON_ORDEN_ACTIVA(HttpStatus.CONFLICT),
    TRANSICION_INVALIDA(HttpStatus.CONFLICT),
    ORDEN_ESTADO_INVALIDO(HttpStatus.CONFLICT),
    ERROR_INTERNO(HttpStatus.INTERNAL_SERVER_ERROR);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
