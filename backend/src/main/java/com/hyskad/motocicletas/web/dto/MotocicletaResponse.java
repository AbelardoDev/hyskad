package com.hyskad.motocicletas.web.dto;

import java.time.Instant;

/** Moto con su ficha técnica y el propietario actual (solo id y nombre). */
public record MotocicletaResponse(Long id, String placa, String marca, String modelo, Integer anio, String vin,
        Integer cilindradaCc, String color, boolean activo, Propietario propietario, Instant createdAt) {

    public record Propietario(Long id, String nombreCompleto, boolean activo) {
    }
}
