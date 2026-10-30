package com.hyskad.taller.web;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Component;

import com.hyskad.clientes.domain.Cliente;
import com.hyskad.motocicletas.domain.Motocicleta;
import com.hyskad.taller.application.OrdenTrabajoService.DetalleOrden;
import com.hyskad.taller.domain.OrdenMecanico;
import com.hyskad.taller.domain.OrdenTrabajo;
import com.hyskad.taller.web.dto.OrdenResponse;
import com.hyskad.taller.web.dto.OrdenResumenResponse;
import com.hyskad.taller.web.dto.UsuarioResumen;
import com.hyskad.usuarios.application.UsuarioService;

/** Arma las respuestas de órdenes con los nombres de mecánicos y de quienes cambiaron el estado. */
@Component
class OrdenesWeb {

    private final UsuarioService usuarios;

    OrdenesWeb(UsuarioService usuarios) {
        this.usuarios = usuarios;
    }

    List<OrdenResumenResponse> resumenes(Collection<OrdenTrabajo> ordenes) {
        Map<Long, String> nombres = usuarios.nombres(ordenes.stream().flatMap(o -> o.getMecanicos().stream())
                .map(OrdenMecanico::getMecanicoId).collect(Collectors.toSet()));
        return ordenes.stream().map(o -> new OrdenResumenResponse(o.getId(), o.getNumero(), o.getEstado(),
                o.getFechaIngreso(), o.getMotocicleta().getPlaca(), moto(o.getMotocicleta()),
                o.getCliente().getNombreCompleto(), o.getMecanicos().stream()
                        .map(m -> usuario(m.getMecanicoId(), nombres)).toList())).toList();
    }

    OrdenResponse detalle(DetalleOrden detalle) {
        OrdenTrabajo o = detalle.orden();
        Map<Long, String> nombres = usuarios.nombres(Stream.concat(Stream.concat(
                o.getMecanicos().stream().map(OrdenMecanico::getMecanicoId),
                o.getHistorial().stream().map(h -> h.getUsuarioId())), Stream.of(o.getCreatedBy()))
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        return new OrdenResponse(o.getId(), o.getNumero(), o.getEstado(), o.getVersion(), o.getFechaIngreso(),
                o.getKilometrajeIngreso(), o.getMotivoIngreso(), o.getDescripcionProblema(), o.getObservaciones(),
                o.getDiagnostico(), o.getObservacionesDiagnostico(), o.getKilometrajeInspeccion(),
                cliente(o.getCliente()), motocicleta(o.getMotocicleta()),
                o.getMecanicos().stream().map(m -> new OrdenResponse.Mecanico(m.getMecanicoId(),
                        nombres.get(m.getMecanicoId()), m.getActividad(), m.getAsignadoEn())).toList(),
                o.getHistorial().stream().map(h -> new OrdenResponse.Historial(h.getEstadoAnterior(),
                        h.getEstadoNuevo(), h.getNota(), usuario(h.getUsuarioId(), nombres), h.getFecha())).toList(),
                usuario(o.getCreatedBy(), nombres), detalle.acciones());
    }

    private static String moto(Motocicleta m) {
        return m.getMarca() + " " + m.getModelo();
    }

    private static OrdenResponse.ClienteResumen cliente(Cliente c) {
        return new OrdenResponse.ClienteResumen(c.getId(), c.getNombreCompleto(), c.getTipoDocumento(),
                c.getNumeroDocumento(), c.getTelefono());
    }

    private static OrdenResponse.MotoResumen motocicleta(Motocicleta m) {
        return new OrdenResponse.MotoResumen(m.getId(), m.getPlaca(), m.getMarca(), m.getModelo(), m.getAnio(),
                m.getColor());
    }

    private static UsuarioResumen usuario(Long id, Map<Long, String> nombres) {
        return id == null ? null : new UsuarioResumen(id, nombres.get(id));
    }
}
