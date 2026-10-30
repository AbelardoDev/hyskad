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
     * Teléfono colombiano solo con dígitos: quita espacios, guiones, puntos, paréntesis y el
     * indicativo {@code +57}: {@code "+57 300 123-4567"} → {@code "3001234567"}.
     */
    public static String telefono(String telefono) {
        if (telefono == null) {
            return null;
        }
        String digitos = telefono.replaceAll("[\\s().-]", "");
        return digitos.startsWith("+57") ? digitos.substring(3) : digitos;
    }

    /** VIN en mayúsculas y sin espacios alrededor; vacío se trata como ausente. */
    public static String vin(String vin) {
        return vin == null || vin.isBlank() ? null : vin.trim().toUpperCase(Locale.ROOT);
    }

    /** Email sin espacios alrededor y en minúsculas, para que la unicidad no dependa de mayúsculas. */
    public static String email(String email) {
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
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
