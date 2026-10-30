package com.hyskad.clientes.web.dto;

import java.time.Instant;

import com.hyskad.shared.validation.TipoDocumento;

/** Ficha completa del cliente (detalle y edición). */
public record ClienteResponse(Long id, TipoDocumento tipoDocumento, String numeroDocumento, String nombres,
        String apellidos, String razonSocial, String nombreCompleto, String telefono, String email,
        String direccion, String ciudad, boolean aceptaTratamientoDatos, Instant fechaAceptacionDatos,
        long cantidadMotos, boolean activo, Instant createdAt) {
}
