package com.hyskad.taller.web;

import java.util.Map;
import java.util.stream.Stream;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.configuracion.application.DatosTaller;
import com.hyskad.taller.application.OrdenTrabajoService;
import com.hyskad.taller.application.PagoEntregaService.Comprobante;
import com.hyskad.taller.application.PagoEntregaService;
import com.hyskad.taller.application.RegistrarEntrega;
import com.hyskad.taller.application.RegistrarPago;
import com.hyskad.taller.domain.OrdenMecanico;
import com.hyskad.taller.domain.OrdenTrabajo;
import com.hyskad.taller.web.dto.ComprobanteOrdenResponse;
import com.hyskad.taller.web.dto.OrdenResponse;

import jakarta.validation.Valid;

/** Pago (RF25, {@code PAGOS_REGISTRAR}), entrega (RF28, {@code ENTREGAS_REGISTRAR}) y comprobante (RF27). */
@RestController
@RequestMapping("/api/v1/ordenes-trabajo")
public class PagoEntregaController {

    private final PagoEntregaService service;
    private final OrdenTrabajoService ordenes;
    private final OrdenesWeb web;

    public PagoEntregaController(PagoEntregaService service, OrdenTrabajoService ordenes, OrdenesWeb web) {
        this.service = service;
        this.ordenes = ordenes;
        this.web = web;
    }

    /** Devuelve la orden actualizada, con el pago y las acciones nuevas. */
    @PostMapping("/{id}/pago")
    @PreAuthorize("hasAuthority('PAGOS_REGISTRAR')")
    public OrdenResponse registrarPago(@PathVariable Long id, @Valid @RequestBody RegistrarPago datos) {
        service.registrarPago(id, datos);
        return web.detalle(ordenes.detalle(id));
    }

    @PostMapping("/{id}/entrega")
    @PreAuthorize("hasAuthority('ENTREGAS_REGISTRAR')")
    public OrdenResponse registrarEntrega(@PathVariable Long id, @Valid @RequestBody RegistrarEntrega datos) {
        service.registrarEntrega(id, datos);
        return web.detalle(ordenes.detalle(id));
    }

    @GetMapping("/{id}/comprobante")
    @PreAuthorize("hasAnyAuthority('ORDENES_VER_TODAS', 'ORDENES_VER_ASIGNADAS')")
    public ComprobanteOrdenResponse comprobante(@PathVariable Long id) {
        Comprobante comprobante = service.comprobante(id);
        OrdenTrabajo o = comprobante.orden();
        DatosTaller t = comprobante.taller();
        Map<Long, String> nombres = web.nombres(Stream.concat(
                o.getMecanicos().stream().map(OrdenMecanico::getMecanicoId),
                Stream.of(comprobante.pago().getUsuarioId())).toList());
        var cliente = o.getCliente();
        var moto = o.getMotocicleta();
        return new ComprobanteOrdenResponse(
                new ComprobanteOrdenResponse.Taller(t.nombre(), t.nit(), t.direccion(), t.telefono()),
                o.getNumero(), o.getEstado(), o.getFechaIngreso(), o.getFechaFinalizacion(), o.getFechaEntrega(),
                new ComprobanteOrdenResponse.Cliente(cliente.getNombreCompleto(), cliente.getTipoDocumento(),
                        cliente.getNumeroDocumento(), cliente.getTelefono()),
                new ComprobanteOrdenResponse.Moto(moto.getPlaca(), moto.getMarca(), moto.getModelo(), moto.getAnio(),
                        moto.getColor()),
                o.getKilometrajeIngreso(), o.getKilometrajeInspeccion(), o.getMotivoIngreso(),
                ComprobanteOrdenResponse.resumir(o.getDiagnostico()),
                o.getMecanicos().stream().map(m -> nombres.get(m.getMecanicoId())).toList(),
                o.getServicios().stream().map(s -> new ComprobanteOrdenResponse.Servicio(s.getDescripcion(),
                        s.getPrecio())).toList(),
                o.getRepuestos().stream().map(r -> new ComprobanteOrdenResponse.Repuesto(r.getProducto().getCodigo(),
                        r.getProducto().getNombre(), r.getProducto().getUnidad(), r.getCantidad(),
                        r.getPrecioUnitario(), r.getSubtotal())).toList(),
                o.getSubtotal(), o.getDescuento(), o.getIvaPorcentaje(), o.getImpuesto(), o.getTotal(),
                OrdenesWeb.pago(comprobante.pago(), nombres), ComprobanteOrdenResponse.LEYENDA);
    }
}
