package com.hyskad.auth.web;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Component;

import com.hyskad.shared.error.DemasiadasSolicitudesException;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;

/**
 * Rate limiting en memoria con Bucket4j (IC6, RN-49): un bucket por regla y clave (IP, IP+email o
 * usuario). Basta con un nodo; si el mapa crece demasiado se vacía, lo que solo devuelve intentos.
 */
@Component
public class LimitadorIntentos {

    private static final int MAX_CLAVES = 50_000;

    public enum Regla {
        LOGIN(5, Duration.ofMinutes(1)),
        REFRESH(30, Duration.ofMinutes(1)),
        OLVIDE_PASSWORD(3, Duration.ofMinutes(15)),
        RESTABLECER_PASSWORD(10, Duration.ofMinutes(15)),
        CAMBIAR_PASSWORD(10, Duration.ofMinutes(15));

        private final long capacidad;
        private final Duration periodo;

        Regla(long capacidad, Duration periodo) {
            this.capacidad = capacidad;
            this.periodo = periodo;
        }
    }

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    /** Consume un intento o lanza 429 con los segundos que faltan para el siguiente. */
    public void consumir(Regla regla, String clave) {
        if (buckets.size() > MAX_CLAVES) {
            buckets.clear();
        }
        Bucket bucket = buckets.computeIfAbsent(regla.name() + '|' + clave, k -> Bucket.builder()
                .addLimit(limite -> limite.capacity(regla.capacidad).refillIntervally(regla.capacidad, regla.periodo))
                .build());
        ConsumptionProbe intento = bucket.tryConsumeAndReturnRemaining(1);
        if (!intento.isConsumed()) {
            long segundos = TimeUnit.NANOSECONDS.toSeconds(intento.getNanosToWaitForRefill()) + 1;
            throw new DemasiadasSolicitudesException(segundos);
        }
    }
}
