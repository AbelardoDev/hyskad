package com.hyskad.proveedores.web.dto;

import java.time.Instant;

import com.hyskad.shared.validation.TipoDocumento;

public record ProveedorResponse(Long id, TipoDocumento tipoDocumento, String numeroDocumento, String razonSocial,
        String contacto, String telefono, String email, String direccion, boolean activo, Instant createdAt) {
}
