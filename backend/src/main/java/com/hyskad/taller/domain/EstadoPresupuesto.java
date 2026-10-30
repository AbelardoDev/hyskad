package com.hyskad.taller.domain;

/** RN-31 a RN-33: solo un presupuesto PENDIENTE por orden; los demás quedan decididos o reemplazados. */
public enum EstadoPresupuesto {
    PENDIENTE,
    APROBADO,
    RECHAZADO,
    REEMPLAZADO
}
