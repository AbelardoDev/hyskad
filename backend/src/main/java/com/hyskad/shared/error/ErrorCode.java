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
    ERROR_INTERNO(HttpStatus.INTERNAL_SERVER_ERROR);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
