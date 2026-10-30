package com.hyskad.shared.error;

import java.util.Map;

/** El estado actual de los datos impide la operación (duplicados, estado inválido...). */
public class ConflictException extends BusinessException {

    public ConflictException(ErrorCode code, String mensaje) {
        super(code, mensaje);
    }

    public ConflictException(ErrorCode code, String mensaje, Map<String, Object> parametros) {
        super(code, mensaje, parametros);
    }
}
