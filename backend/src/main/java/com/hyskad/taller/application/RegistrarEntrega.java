package com.hyskad.taller.application;

import jakarta.validation.constraints.Size;

/** RN-36: observaciones opcionales de la entrega. */
public record RegistrarEntrega(@Size(max = 1000) String observaciones) {
}
