package com.hyskad.shared.validation;

/** Dígito de verificación del NIT según la DIAN (RN-39): módulo 11 con pesos primos. */
public final class DigitoVerificacionNit {

    private static final int[] PESOS = { 3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71 };

    private DigitoVerificacionNit() {
    }

    /** Calcula el DV de un NIT sin DV (solo dígitos, máximo 15). */
    public static int calcular(String nit) {
        if (nit == null || !nit.matches("\\d{1,15}")) {
            throw new IllegalArgumentException("El NIT debe tener entre 1 y 15 dígitos");
        }
        int suma = 0;
        for (int i = 0; i < nit.length(); i++) {
            int digito = Character.digit(nit.charAt(nit.length() - 1 - i), 10);
            suma += digito * PESOS[i];
        }
        int residuo = suma % 11;
        return residuo < 2 ? residuo : 11 - residuo;
    }
}
