package com.hyskad.taller.web;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.hyskad.configuracion.application.DatosTaller;
import com.hyskad.taller.application.DecidirPresupuesto;
import com.hyskad.taller.application.GenerarPresupuesto;
import com.hyskad.taller.application.PresupuestoService;
import com.hyskad.taller.application.PresupuestoService.Documento;
import com.hyskad.taller.domain.OrdenTrabajo;
import com.hyskad.taller.domain.Presupuesto;
import com.hyskad.taller.web.dto.DocumentoPresupuestoResponse;
import com.hyskad.taller.web.dto.PresupuestoResponse;
import com.hyskad.taller.web.dto.UsuarioResumen;
import com.hyskad.usuarios.application.UsuarioService;

import jakarta.validation.Valid;

/**
 * Presupuestos (RF22, RF23): se consultan con los permisos de ver órdenes (y solo las visibles,
 * RN-27) y se envían, deciden o retiran con {@code PRESUPUESTOS_GESTIONAR}.
 */
@RestController
@RequestMapping("/api/v1")
public class PresupuestoController {

    private static final String VER = "hasAnyAuthority('ORDENES_VER_TODAS', 'ORDENES_VER_ASIGNADAS')";
    private static final String GESTIONAR = "hasAuthority('PRESUPUESTOS_GESTIONAR')";

    private final PresupuestoService service;
    private final UsuarioService usuarios;

    public PresupuestoController(PresupuestoService service, UsuarioService usuarios) {
        this.service = service;
        this.usuarios = usuarios;
    }

    /** Todas las versiones de la orden, la más reciente primero. */
    @GetMapping("/ordenes-trabajo/{id}/presupuestos")
    @PreAuthorize(VER)
    public List<PresupuestoResponse> deOrden(@PathVariable Long id) {
        List<Presupuesto> presupuestos = service.deOrden(id);
        Map<Long, String> nombres = nombres(presupuestos);
        return presupuestos.stream().map(p -> respuesta(p, nombres)).toList();
    }

    @PostMapping("/ordenes-trabajo/{id}/presupuestos")
    @PreAuthorize(GESTIONAR)
    public ResponseEntity<PresupuestoResponse> generar(@PathVariable Long id,
            @Valid @RequestBody GenerarPresupuesto datos) {
        Presupuesto presupuesto = service.generar(id, datos);
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/presupuestos/{id}").buildAndExpand(presupuesto.getId()).toUri();
        return ResponseEntity.created(ubicacion).body(respuesta(presupuesto, nombres(List.of(presupuesto))));
    }

    /** Documento imprimible con los datos del taller, el cliente y la moto. */
    @GetMapping("/presupuestos/{id}")
    @PreAuthorize(VER)
    public DocumentoPresupuestoResponse documento(@PathVariable Long id) {
        Documento documento = service.documento(id);
        Presupuesto p = documento.presupuesto();
        OrdenTrabajo o = documento.orden();
        DatosTaller taller = documento.taller();
        return new DocumentoPresupuestoResponse(
                new DocumentoPresupuestoResponse.Taller(taller.nombre(), taller.nit(), taller.direccion(),
                        taller.telefono()),
                o.getNumero(),
                new DocumentoPresupuestoResponse.Cliente(o.getCliente().getNombreCompleto(),
                        o.getCliente().getTipoDocumento(), o.getCliente().getNumeroDocumento(),
                        o.getCliente().getTelefono()),
                new DocumentoPresupuestoResponse.Moto(o.getMotocicleta().getPlaca(), o.getMotocicleta().getMarca(),
                        o.getMotocicleta().getModelo(), o.getMotocicleta().getAnio()),
                respuesta(p, nombres(List.of(p))), DocumentoPresupuestoResponse.LEYENDA);
    }

    @PostMapping("/presupuestos/{id}/decision")
    @PreAuthorize(GESTIONAR)
    public PresupuestoResponse decidir(@PathVariable Long id, @Valid @RequestBody DecidirPresupuesto datos) {
        Presupuesto p = service.decidir(id, datos);
        return respuesta(p, nombres(List.of(p)));
    }

    @PostMapping("/presupuestos/{id}/retiro")
    @PreAuthorize(GESTIONAR)
    public PresupuestoResponse retirar(@PathVariable Long id) {
        Presupuesto p = service.retirar(id);
        return respuesta(p, nombres(List.of(p)));
    }

    private Map<Long, String> nombres(List<Presupuesto> presupuestos) {
        return usuarios.nombres(presupuestos.stream().flatMap(p -> Stream.of(p.getEnviadoPor(), p.getDecididoPor()))
                .filter(Objects::nonNull).collect(Collectors.toSet()));
    }

    private static PresupuestoResponse respuesta(Presupuesto p, Map<Long, String> nombres) {
        return new PresupuestoResponse(p.getId(), p.getOrden().getId(), p.getNumero(), p.getVersion(), p.getEstado(),
                p.getItems().stream().map(i -> new PresupuestoResponse.Item(i.getTipo(), i.getDescripcion(),
                        i.getCantidad(), i.getPrecioUnitario(), i.getSubtotal())).toList(),
                p.getSubtotal(), p.getDescuento(), p.getIvaPorcentaje(), p.getImpuesto(), p.getTotal(),
                p.getObservaciones(), p.getFechaEnvio(), usuario(p.getEnviadoPor(), nombres), p.getFechaDecision(),
                usuario(p.getDecididoPor(), nombres), p.getObservacionesDecision());
    }

    private static UsuarioResumen usuario(Long id, Map<Long, String> nombres) {
        return id == null ? null : new UsuarioResumen(id, nombres.get(id));
    }
}
