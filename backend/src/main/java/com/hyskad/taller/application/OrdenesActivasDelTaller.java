package com.hyskad.taller.application;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.clientes.application.ConsultaOrdenesActivas;
import com.hyskad.taller.domain.EstadoOrden;
import com.hyskad.taller.persistence.OrdenTrabajoRepository;

/** RN-44: responde a clientes y motocicletas si hay órdenes activas (no ENTREGADA ni CANCELADA). */
@Component
class OrdenesActivasDelTaller implements ConsultaOrdenesActivas {

    private final OrdenTrabajoRepository repository;

    OrdenesActivasDelTaller(OrdenTrabajoRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean tieneOrdenActiva(Long motocicletaId) {
        return repository.existsByMotocicletaIdAndEstadoIn(motocicletaId, EstadoOrden.activos());
    }

    @Override
    @Transactional(readOnly = true)
    public boolean clienteTieneOrdenesActivas(Long clienteId) {
        return repository.existsByClienteIdAndEstadoIn(clienteId, EstadoOrden.activos());
    }
}
