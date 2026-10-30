package com.hyskad.ventas.persistence;

import java.math.BigDecimal;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.ventas.domain.Venta;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Root;

/** Implementación de {@link VentaResumenRepository} con Criteria (la usa Spring Data por convención). */
class VentaResumenRepositoryImpl implements VentaResumenRepository {

    private final EntityManager entityManager;

    VentaResumenRepositoryImpl(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    public Resumen resumir(Specification<Venta> filtro) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> consulta = cb.createTupleQuery();
        Root<Venta> raiz = consulta.from(Venta.class);
        consulta.multiselect(cb.count(raiz), cb.coalesce(cb.sum(raiz.<BigDecimal>get("total")), BigDecimal.ZERO))
                .where(filtro.toPredicate(raiz, consulta, cb));
        Tuple fila = entityManager.createQuery(consulta).getSingleResult();
        return new Resumen(fila.get(0, Long.class), fila.get(1, BigDecimal.class));
    }
}
