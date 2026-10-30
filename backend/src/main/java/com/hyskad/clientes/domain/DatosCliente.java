package com.hyskad.clientes.domain;

import com.hyskad.shared.validation.TipoDocumento;

/** Datos ya validados y normalizados de un cliente, listos para guardar. */
public record DatosCliente(TipoDocumento tipoDocumento, String numeroDocumento, String nombres, String apellidos,
        String razonSocial, String telefono, String email, String direccion, String ciudad,
        boolean aceptaTratamientoDatos) {
}
