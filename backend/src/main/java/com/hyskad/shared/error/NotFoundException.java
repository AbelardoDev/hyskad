package com.hyskad.shared.error;

import java.util.Map;

/** El recurso pedido no existe (o el usuario no puede verlo). */
public class NotFoundException extends BusinessException {

    public NotFoundException(String recurso, Object id) {
        super(ErrorCode.RECURSO_NO_ENCONTRADO, recurso + " no encontrado: " + id,
                Map.of("recurso", recurso, "id", String.valueOf(id)));
    }
}
