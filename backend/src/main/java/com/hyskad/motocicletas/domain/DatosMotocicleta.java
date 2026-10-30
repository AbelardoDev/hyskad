package com.hyskad.motocicletas.domain;

/** Ficha técnica ya validada y normalizada de una moto. */
public record DatosMotocicleta(String placa, String marca, String modelo, Integer anio, String vin,
        Integer cilindradaCc, String color) {
}
