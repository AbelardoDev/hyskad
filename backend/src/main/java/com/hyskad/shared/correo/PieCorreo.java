package com.hyskad.shared.correo;

/**
 * Datos del taller para el pie de los correos. La implementa {@code configuracion} (donde viven
 * esos datos), así {@code shared} no depende de un módulo de negocio.
 */
public interface PieCorreo {

    Datos datos();

    record Datos(String nombre, String nit, String direccion, String telefono) {
    }
}
