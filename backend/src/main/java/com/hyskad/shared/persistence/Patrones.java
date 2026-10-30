package com.hyskad.shared.persistence;

/** Patrones {@code LIKE} para las búsquedas parciales de las {@code Specification}. */
public final class Patrones {

    /** Carácter de escape que se pasa a {@code cb.like(..., ESCAPE)}. */
    public static final char ESCAPE = '\\';

    private Patrones() {
    }

    /** {@code %texto%} con los comodines del usuario escapados, para buscarlos literalmente. */
    public static String contiene(String texto) {
        return "%" + escapar(texto) + "%";
    }

    private static String escapar(String texto) {
        return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
