package com.hyskad.proveedores.domain;

import com.hyskad.shared.validation.TipoDocumento;

/** Datos ya validados y normalizados de un proveedor. */
public record DatosProveedor(TipoDocumento tipoDocumento, String numeroDocumento, String razonSocial,
        String contacto, String telefono, String email, String direccion) {
}
