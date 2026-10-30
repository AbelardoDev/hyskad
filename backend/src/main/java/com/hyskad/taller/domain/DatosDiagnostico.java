package com.hyskad.taller.domain;

/** Diagnóstico ya normalizado (RF14). El kilometraje de inspección es opcional y ≥ al de ingreso. */
public record DatosDiagnostico(String diagnostico, String observaciones, Integer kilometrajeInspeccion) {
}
