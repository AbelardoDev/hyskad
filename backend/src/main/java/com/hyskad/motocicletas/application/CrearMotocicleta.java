package com.hyskad.motocicletas.application;

import com.hyskad.shared.validation.PlacaColombiana;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** Datos para registrar una moto de un cliente activo (RF7). */
public record CrearMotocicleta(
        @NotNull Long clienteId,
        @NotBlank @PlacaColombiana String placa,
        @NotBlank @Size(max = 60) String marca,
        @NotBlank @Size(max = 60) String modelo,
        @Min(FichaMotocicleta.ANIO_MINIMO) @Max(FichaMotocicleta.ANIO_MAXIMO) Integer anio,
        @Pattern(regexp = FichaMotocicleta.VIN, message = "VIN_INVALIDO") String vin,
        @Positive @Max(FichaMotocicleta.CILINDRADA_MAXIMA) Integer cilindradaCc,
        @Size(max = 40) String color) {
}
