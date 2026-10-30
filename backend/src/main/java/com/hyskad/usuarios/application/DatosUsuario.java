package com.hyskad.usuarios.application;

/** Formatos compartidos por los comandos de usuarios. */
final class DatosUsuario {

    /** Dígitos con espacios opcionales y un {@code +} inicial, de 7 a 20 caracteres. */
    static final String TELEFONO = "^\\+?[0-9 ]{7,20}$";
    static final String IDIOMA = "^(es|en)$";
    static final String IDIOMA_POR_DEFECTO = "es";

    private DatosUsuario() {
    }
}
