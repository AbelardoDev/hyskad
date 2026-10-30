package com.hyskad.motocicletas.application;

/** Límites de la ficha técnica compartidos por los comandos de motos (RN-41, RN-42). */
final class FichaMotocicleta {

    /** 17 caracteres alfanuméricos sin I, O ni Q (RN-42); vacío equivale a no informarlo. */
    static final String VIN = "^([A-HJ-NPR-Za-hj-npr-z0-9]{17})?$";
    static final int ANIO_MINIMO = 1900;
    static final int ANIO_MAXIMO = 2100;
    static final int CILINDRADA_MAXIMA = 3000;

    private FichaMotocicleta() {
    }
}
