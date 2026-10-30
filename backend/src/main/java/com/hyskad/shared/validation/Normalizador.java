package com.hyskad.shared.validation;

import java.util.Locale;

/** Normalización de identificadores antes de validar y guardar. */
public final class Normalizador {

    private Normalizador() {
    }

    /** Placa en mayúsculas, sin espacios ni guiones (RN-41): {@code "abc-12 d"} → {@code "ABC12D"}. */
    public static String placa(String placa) {
        return placa == null ? null : placa.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
    }

    /** Documento en mayúsculas, sin espacios, guiones ni puntos: {@code "900.123.456-8"} → {@code "9001234568"}. */
    public static String documento(String numero) {
        return numero == null ? null : numero.replaceAll("[\\s.-]", "").toUpperCase(Locale.ROOT);
    }

    /**
     * Forma de guardar un documento: el NIT como {@code 900123456-8} (RN-39) y los demás
     * normalizados. Supone que el documento ya pasó la validación.
     */
    public static String documentoParaGuardar(TipoDocumento tipo, String numero) {
        String normalizado = documento(numero);
        if (tipo != TipoDocumento.NIT || normalizado == null || normalizado.length() < 2) {
            return normalizado;
        }
        int corte = normalizado.length() - 1;
        return normalizado.substring(0, corte) + "-" + normalizado.substring(corte);
    }
}
