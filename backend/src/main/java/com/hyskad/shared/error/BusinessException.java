package com.hyskad.shared.error;

import java.util.List;
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

    /**
     * Error de validación detectado en el servicio (no por Bean Validation), con el mismo formato:
     * 400 {@code VALIDACION} y {@code errors[]} por campo, p. ej. {@code items[1].productoId}.
     */
    public static BusinessException validacion(List<ErrorCampo> errores) {
        return new BusinessException(ErrorCode.VALIDACION, "La solicitud tiene datos inválidos",
                Map.of("errors", List.copyOf(errores)));
    }

    public ErrorCode getCode() {
        return code;
    }

    public Map<String, Object> getParametros() {
        return parametros;
    }
}
