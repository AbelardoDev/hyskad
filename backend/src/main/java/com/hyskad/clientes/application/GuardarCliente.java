package com.hyskad.clientes.application;

import com.hyskad.shared.validation.ConDocumento;
import com.hyskad.shared.validation.DocumentoValido;
import com.hyskad.shared.validation.TelefonoColombiano;
import com.hyskad.shared.validation.TipoDocumento;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Datos para crear o reemplazar un cliente (RF5, RF6). Documento según su tipo (RN-38, RN-39),
 * razón social con NIT y nombres/apellidos con los demás tipos, y la decisión sobre el
 * tratamiento de datos (RN-45), que es obligatoria.
 */
@DocumentoValido
@NombreSegunDocumento
public record GuardarCliente(
        @NotNull TipoDocumento tipoDocumento,
        @NotBlank @Size(max = 20) String numeroDocumento,
        @Size(max = 80) String nombres,
        @Size(max = 80) String apellidos,
        @Size(max = 150) String razonSocial,
        @NotBlank @TelefonoColombiano String telefono,
        @Email @Size(max = 254) String email,
        @Size(max = 200) String direccion,
        @Size(max = 80) String ciudad,
        @NotNull Boolean aceptaTratamientoDatos) implements ConDocumento {

    /** Sin datos personales: los logs no deben llevar documentos ni contactos completos. */
    @Override
    public String toString() {
        return "GuardarCliente[tipoDocumento=" + tipoDocumento + "]";
    }
}
