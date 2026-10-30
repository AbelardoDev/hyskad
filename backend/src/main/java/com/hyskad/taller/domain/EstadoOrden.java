package com.hyskad.taller.domain;

import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import com.hyskad.usuarios.domain.Permiso;

/**
 * Estados de la orden de trabajo como máquina de estados (BUSINESS-RULES §6.1, ARCHITECTURE §6).
 * El enum declara qué transiciones existen, quién puede pedirlas y si exigen nota; las condiciones
 * y los efectos de cada una (mecánicos, diagnóstico, reservas, inventario) los orquesta
 * {@code OrdenTrabajoService}. Cualquier otra transición se rechaza (RN-22).
 */
public enum EstadoOrden {

    RECIBIDA,
    EN_DIAGNOSTICO,
    PENDIENTE_APROBACION,
    EN_REPARACION,
    FINALIZADA,
    ENTREGADA,
    CANCELADA;

    private static final Map<EstadoOrden, Map<EstadoOrden, Regla>> TRANSICIONES = new EnumMap<>(EstadoOrden.class);

    static {
        for (EstadoOrden estado : values()) {
            TRANSICIONES.put(estado, new EnumMap<>(EstadoOrden.class));
        }
        permitir(RECIBIDA, EN_DIAGNOSTICO, new Regla(Permiso.ORDENES_TRABAJAR, false));
        permitir(EN_DIAGNOSTICO, PENDIENTE_APROBACION, new Regla(Permiso.PRESUPUESTOS_GESTIONAR, false));
        // Solo al registrar el presupuesto aprobado (F09B)
        permitir(PENDIENTE_APROBACION, EN_REPARACION, Regla.AUTOMATICA);
        // Retirar el presupuesto para ajustarlo
        permitir(PENDIENTE_APROBACION, EN_DIAGNOSTICO, new Regla(Permiso.PRESUPUESTOS_GESTIONAR, false));
        // "Requiere ajuste": aparecieron nuevos trabajos
        permitir(EN_REPARACION, EN_DIAGNOSTICO, new Regla(Permiso.ORDENES_TRABAJAR, true));
        permitir(EN_REPARACION, FINALIZADA, new Regla(Permiso.ORDENES_TRABAJAR, false));
        permitir(FINALIZADA, ENTREGADA, new Regla(Permiso.ENTREGAS_REGISTRAR, false));
        // Cancelar con motivo; desde PENDIENTE_APROBACION también ocurre al rechazar el presupuesto
        for (EstadoOrden activa : EnumSet.of(RECIBIDA, EN_DIAGNOSTICO, PENDIENTE_APROBACION, EN_REPARACION)) {
            permitir(activa, CANCELADA, new Regla(Permiso.ORDENES_CREAR, true));
        }
    }

    private static void permitir(EstadoOrden desde, EstadoOrden hasta, Regla regla) {
        TRANSICIONES.get(desde).put(hasta, regla);
    }

    public boolean puedeTransicionarA(EstadoOrden destino) {
        return TRANSICIONES.get(this).containsKey(destino);
    }

    /** Destinos posibles desde este estado, en el orden del flujo. */
    public Set<EstadoOrden> destinos() {
        return Collections.unmodifiableSet(TRANSICIONES.get(this).keySet());
    }

    /** Regla de la transición hacia {@code destino}; vacío si no existe. */
    public Optional<Regla> regla(EstadoOrden destino) {
        return Optional.ofNullable(TRANSICIONES.get(this).get(destino));
    }

    /** ENTREGADA y CANCELADA no tienen salida (RN-22). */
    public boolean esFinal() {
        return TRANSICIONES.get(this).isEmpty();
    }

    /** Estados en los que la orden cuenta como activa (RN-24, RN-44). */
    public static Set<EstadoOrden> activos() {
        return EnumSet.complementOf(finales());
    }

    public static EnumSet<EstadoOrden> finales() {
        return EnumSet.of(ENTREGADA, CANCELADA);
    }

    /**
     * Quién puede pedir una transición y si exige nota. Sin permiso es automática: solo la dispara
     * el sistema como efecto de otra operación (p. ej. aprobar un presupuesto).
     */
    public record Regla(Permiso permiso, boolean requiereNota) {

        static final Regla AUTOMATICA = new Regla(null, false);

        public boolean esAutomatica() {
            return permiso == null;
        }
    }
}
