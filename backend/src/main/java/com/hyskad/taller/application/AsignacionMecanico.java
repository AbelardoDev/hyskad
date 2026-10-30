package com.hyskad.taller.application;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Un mecánico para la orden y, opcionalmente, qué va a hacer en ella (RN-26). */
public record AsignacionMecanico(@NotNull Long mecanicoId, @Size(max = 200) String actividad) {
}
