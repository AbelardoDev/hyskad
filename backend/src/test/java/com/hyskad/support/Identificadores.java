package com.hyskad.support;

import java.util.concurrent.ThreadLocalRandom;

import com.hyskad.shared.validation.DigitoVerificacionNit;

/**
 * Documentos y placas válidos y (casi seguro) irrepetibles: las pruebas de integración comparten
 * la BD, así que cada una crea los suyos.
 */
public final class Identificadores {

    private static final String LETRAS = "ABCDEFGHJKLMNPRSTUVWXYZ";

    private Identificadores() {
    }

    /** Cédula de 10 dígitos. */
    public static String cedula() {
        return "1" + digitos(9);
    }

    /** NIT de 9 dígitos con su DV, sin guion: {@code 9001234568}. */
    public static String nit() {
        String base = "9" + digitos(8);
        return base + DigitoVerificacionNit.calcular(base);
    }

    /** Placa de moto actual: {@code ABC12D}. */
    public static String placa() {
        return letras(3) + digitos(2) + letras(1);
    }

    /** VIN de 17 caracteres sin I, O ni Q. */
    public static String vin() {
        return letras(3) + digitos(14);
    }

    private static String digitos(int cantidad) {
        StringBuilder texto = new StringBuilder();
        for (int i = 0; i < cantidad; i++) {
            texto.append(ThreadLocalRandom.current().nextInt(10));
        }
        return texto.toString();
    }

    private static String letras(int cantidad) {
        StringBuilder texto = new StringBuilder();
        for (int i = 0; i < cantidad; i++) {
            texto.append(LETRAS.charAt(ThreadLocalRandom.current().nextInt(LETRAS.length())));
        }
        return texto.toString();
    }
}
