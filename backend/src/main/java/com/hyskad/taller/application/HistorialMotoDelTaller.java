package com.hyskad.taller.application;

import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.motocicletas.application.HistorialMotocicleta;
import com.hyskad.motocicletas.application.HistorialServicio;
import com.hyskad.taller.domain.OrdenMecanico;
import com.hyskad.taller.domain.OrdenTrabajo;
import com.hyskad.taller.persistence.OrdenTrabajoRepository;
import com.hyskad.taller.persistence.OrdenTrabajoSpecifications;
import com.hyskad.usuarios.application.UsuarioService;

/**
 * RF9: historial de la moto con sus órdenes, la más reciente primero (el orden lo fija el
 * historial, no quien consulta). Servicios, repuestos y mecánicos se cargan por lotes.
 */
@Component
class HistorialMotoDelTaller implements HistorialMotocicleta {

    private static final Sort MAS_RECIENTE_PRIMERO = Sort.by(Sort.Order.desc("fechaIngreso"), Sort.Order.desc("id"));

    private final OrdenTrabajoRepository repository;
    private final UsuarioService usuarios;

    HistorialMotoDelTaller(OrdenTrabajoRepository repository, UsuarioService usuarios) {
        this.repository = repository;
        this.usuarios = usuarios;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<HistorialServicio> deMotocicleta(Long motocicletaId, boolean incluirCanceladas, Pageable pagina) {
        Specification<OrdenTrabajo> filtro = OrdenTrabajoSpecifications.deMotocicleta(motocicletaId, incluirCanceladas);
        Page<OrdenTrabajo> ordenes = repository.findAll(filtro,
                PageRequest.of(pagina.getPageNumber(), pagina.getPageSize(), MAS_RECIENTE_PRIMERO));
        Map<Long, String> nombres = usuarios.nombres(ordenes.stream().flatMap(o -> o.getMecanicos().stream())
                .map(OrdenMecanico::getMecanicoId).collect(Collectors.toSet()));
        return ordenes.map(o -> entrada(o, nombres));
    }

    private static HistorialServicio entrada(OrdenTrabajo o, Map<Long, String> nombres) {
        return new HistorialServicio(o.getId(), o.getNumero(), o.getEstado().name(), o.getFechaIngreso(),
                o.getFechaFinalizacion(), o.getFechaEntrega(), o.getKilometrajeIngreso(), o.getKilometrajeInspeccion(),
                o.getMotivoIngreso(), o.getDiagnostico(),
                o.getServicios().stream().map(s -> new HistorialServicio.Servicio(s.getDescripcion(), s.getPrecio()))
                        .toList(),
                o.getRepuestos().stream().map(r -> new HistorialServicio.Repuesto(r.getProducto().getCodigo(),
                        r.getProducto().getNombre(), r.getCantidad(), r.getPrecioUnitario(), r.getSubtotal())).toList(),
                o.getTotal(), o.getMecanicos().stream().map(m -> nombres.get(m.getMecanicoId())).toList());
    }
}
