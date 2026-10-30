package com.hyskad.proveedores.application;

import com.hyskad.shared.validation.ConDocumento;
import com.hyskad.shared.validation.DocumentoValido;
import com.hyskad.shared.validation.TelefonoColombiano;
import com.hyskad.shared.validation.TipoDocumento;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Datos para crear o reemplazar un proveedor (RF20). Normalmente con NIT (RN-38, RN-39). */
@DocumentoValido
public record GuardarProveedor(
        @NotNull TipoDocumento tipoDocumento,
        @NotBlank @Size(max = 20) String numeroDocumento,
        @NotBlank @Size(max = 150) String razonSocial,
        @Size(max = 120) String contacto,
        @TelefonoColombiano String telefono,
        @Email @Size(max = 254) String email,
        @Size(max = 200) String direccion) implements ConDocumento {
}
