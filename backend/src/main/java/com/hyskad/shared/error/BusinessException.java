package com.hyskad.shared.error;

import java.util.Map;

/**
 * Violación de una regla de negocio. Se traduce a un ProblemDetail con el status y el código de
 * {@link ErrorCode}; {@code parametros} viaja como propiedades extra para que el frontend arme el
 * mensaje traducido.
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode code;
    private final transient Map<String, Object> parametros;

    public BusinessException(ErrorCode code, String mensaje) {
        this(code, mensaje, Map.of());
    }

    public BusinessException(ErrorCode code, String mensaje, Map<String, Object> parametros) {
        super(mensaje);
        this.code = code;
        this.parametros = Map.copyOf(parametros);
    }

    public ErrorCode getCode() {
        return code;
    }

    public Map<String, Object> getParametros() {
        return parametros;
    }
}
