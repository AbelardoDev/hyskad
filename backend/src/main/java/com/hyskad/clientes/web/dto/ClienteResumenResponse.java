package com.hyskad.clientes.web.dto;

import com.hyskad.shared.validation.TipoDocumento;

/**
 * Cliente en listados: sin dirección ni autorización de datos (Ley 1581, solo lo necesario para
 * identificarlo y contactarlo).
 */
public record ClienteResumenResponse(Long id, TipoDocumento tipoDocumento, String numeroDocumento,
        String nombreCompleto, String telefono, String email, long cantidadMotos, boolean activo) {
}
