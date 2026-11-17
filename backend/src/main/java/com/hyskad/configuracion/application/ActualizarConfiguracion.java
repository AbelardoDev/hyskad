package com.hyskad.configuracion.application;

import java.math.BigDecimal;

import com.hyskad.shared.validation.TelefonoColombiano;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Datos del taller, IVA (RN-03), texto de autorización (RN-45) y alerta de stock (RN-14). */
public record ActualizarConfiguracion(
        @NotBlank @Size(max = 120) String nombre,
        @NotBlank @Size(max = 20) String nit,
        @NotBlank @Size(max = 200) String direccion,
        @NotBlank @TelefonoColombiano String telefono,
        @Email @Size(max = 254) String email,
        @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 2) BigDecimal ivaPorcentaje,
        @NotBlank @Size(max = 4000) String textoAutorizacionDatos,
        boolean alertaStockHabilitada) {
}
