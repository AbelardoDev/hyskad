package com.hyskad.taller.persistence;

import java.time.Instant;
import java.util.Set;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.clientes.domain.Cliente;
import com.hyskad.motocicletas.domain.Motocicleta;
import com.hyskad.shared.persistence.Patrones;
import com.hyskad.shared.validation.Normalizador;
import com.hyskad.taller.domain.EstadoOrden;
import com.hyskad.taller.domain.OrdenMecanico;
import com.hyskad.taller.domain.OrdenTrabajo;

import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Subquery;

/** Filtros opcionales del tablero de órdenes (RF29); un filtro nulo o vacío no restringe. */
public final class OrdenTrabajoSpecifications {

    private OrdenTrabajoSpecifications() {
    }

    /** {@code desde} inclusivo y {@code hasta} exclusivo sobre la fecha de ingreso. */
    public static Specification<OrdenTrabajo> filtrar(String texto, Set<EstadoOrden> estados, Long mecanicoId,
            Instant desde, Instant hasta) {
        return Specification.allOf(contieneTexto(texto), enEstados(estados), asignadaA(mecanicoId),
                ingresoDesde(desde), ingresoAntesDe(hasta));
    }

    /** Número de la orden, placa (también escrita con guion o espacios), cliente o su documento. */
    static Specification<OrdenTrabajo> contieneTexto(String texto) {
        if (texto == null || texto.isBlank()) {
            return Specification.unrestricted();
        }
        String patron = Patrones.contiene(texto.trim());
        String placa = Patrones.contiene(Normalizador.placa(texto.trim()));
        String documento = Patrones.contiene(Normalizador.documento(texto));
        return (raiz, consulta, cb) -> {
            Join<OrdenTrabajo, Cliente> cliente = raiz.join("cliente");
            Join<OrdenTrabajo, Motocicleta> moto = raiz.join("motocicleta");
            return cb.or(
                    cb.like(raiz.get("numero"), patron, Patrones.ESCAPE),
                    cb.like(moto.get("placa"), placa, Patrones.ESCAPE),
                    cb.like(cliente.get("nombreCompleto"), patron, Patrones.ESCAPE),
                    cb.like(cb.function("replace", String.class, cliente.get("numeroDocumento"), cb.literal("-"),
                            cb.literal("")), documento, Patrones.ESCAPE));
        };
    }

    static Specification<OrdenTrabajo> enEstados(Set<EstadoOrden> estados) {
        return estados == null || estados.isEmpty() ? Specification.unrestricted()
                : (raiz, consulta, cb) -> raiz.get("estado").in(estados);
    }

    /** RN-27: también la usa "Mis órdenes" y la vista restringida del mecánico. */
    public static Specification<OrdenTrabajo> asignadaA(Long mecanicoId) {
        if (mecanicoId == null) {
            return Specification.unrestricted();
        }
        return (raiz, consulta, cb) -> {
            Subquery<Integer> asignacion = consulta.subquery(Integer.class);
            var m = asignacion.from(OrdenMecanico.class);
            asignacion.select(cb.literal(1)).where(cb.equal(m.get("orden"), raiz),
                    cb.equal(m.get("id").get("mecanicoId"), mecanicoId));
            return cb.exists(asignacion);
        };
    }

    static Specification<OrdenTrabajo> ingresoDesde(Instant desde) {
        return desde == null ? Specification.unrestricted()
                : (raiz, consulta, cb) -> cb.greaterThanOrEqualTo(raiz.get("fechaIngreso"), desde);
    }

    static Specification<OrdenTrabajo> ingresoAntesDe(Instant hasta) {
        return hasta == null ? Specification.unrestricted()
                : (raiz, consulta, cb) -> cb.lessThan(raiz.get("fechaIngreso"), hasta);
    }
}
