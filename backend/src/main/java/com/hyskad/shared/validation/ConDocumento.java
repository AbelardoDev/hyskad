package com.hyskad.shared.validation;

/**
 * Objeto con tipo y número de documento, validable con {@link DocumentoValido}. Un record lo
 * cumple con componentes {@code tipoDocumento} y {@code numeroDocumento}.
 */
public interface ConDocumento {

    TipoDocumento tipoDocumento();

    String numeroDocumento();
}
