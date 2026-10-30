package com.hyskad.clientes.application;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.clientes.domain.Cliente;
import com.hyskad.clientes.domain.DatosCliente;
import com.hyskad.clientes.persistence.ClienteRepository;
import com.hyskad.clientes.persistence.ClienteSpecifications;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.validation.Normalizador;
import com.hyskad.shared.validation.TipoDocumento;

/**
 * Clientes (RF5, RF6, RF29). Normaliza documento, teléfono y email antes de guardar, aplica
 * RN-40 (documento único por tipo), RN-44 (no desactivar con órdenes activas) y RN-45 (fecha de
 * la autorización de datos), y audita cada cambio sin copiar datos personales al detalle.
 */
@Service
public class ClienteService {

    static final String ENTIDAD = "cliente";

    private final ClienteRepository repository;
    private final ConsultaOrdenesActivas ordenesActivas;
    private final AuditoriaService auditoria;
    private final Clock clock;

    public ClienteService(ClienteRepository repository, ConsultaOrdenesActivas ordenesActivas,
            AuditoriaService auditoria, Clock clock) {
        this.repository = repository;
        this.ordenesActivas = ordenesActivas;
        this.auditoria = auditoria;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<Cliente> listar(String texto, Boolean activo, Pageable pagina) {
        return repository.findAll(ClienteSpecifications.filtrar(texto, activo), pagina);
    }

    @Transactional(readOnly = true)
    public Cliente obtener(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
    }

    /** Cliente al que se le puede asignar una moto: debe existir y estar activo. */
    @Transactional(readOnly = true)
    public Cliente obtenerActivo(Long id) {
        Cliente cliente = obtener(id);
        if (!cliente.isActivo()) {
            throw new ConflictException(ErrorCode.CLIENTE_INACTIVO, "El cliente está inactivo",
                    Map.of("clienteId", id));
        }
        return cliente;
    }

    @Transactional
    public Cliente crear(GuardarCliente datos) {
        DatosCliente normalizados = normalizar(datos);
        if (repository.existsByTipoDocumentoAndNumeroDocumento(normalizados.tipoDocumento(),
                normalizados.numeroDocumento())) {
            throw documentoDuplicado();
        }
        Cliente cliente = repository.save(new Cliente(normalizados, Instant.now(clock)));
        auditoria.registrar("CLIENTE_CREADO", ENTIDAD, cliente.getId(), Map.of(
                "tipoDocumento", cliente.getTipoDocumento().name(),
                "aceptaTratamientoDatos", cliente.isAceptaTratamientoDatos()));
        return cliente;
    }

    @Transactional
    public Cliente actualizar(Long id, GuardarCliente datos) {
        Cliente cliente = obtener(id);
        DatosCliente nuevos = normalizar(datos);
        if (repository.existsByTipoDocumentoAndNumeroDocumentoAndIdNot(nuevos.tipoDocumento(),
                nuevos.numeroDocumento(), id)) {
            throw documentoDuplicado();
        }
        List<String> campos = camposCambiados(cliente, nuevos);
        cliente.actualizar(nuevos, Instant.now(clock));
        if (!campos.isEmpty()) {
            auditoria.registrar("CLIENTE_ACTUALIZADO", ENTIDAD, id, Map.of("campos", campos));
        }
        return cliente;
    }

    @Transactional
    public Cliente cambiarEstado(Long id, boolean activo) {
        Cliente cliente = obtener(id);
        if (cliente.isActivo() == activo) {
            return cliente;
        }
        if (!activo && ordenesActivas.clienteTieneOrdenesActivas(id)) {
            throw new ConflictException(ErrorCode.ORDENES_ACTIVAS,
                    "No se puede desactivar un cliente con órdenes activas");
        }
        cliente.cambiarEstado(activo);
        auditoria.registrar(activo ? "CLIENTE_ACTIVADO" : "CLIENTE_DESACTIVADO", ENTIDAD, id, Map.of());
        return cliente;
    }

    private static DatosCliente normalizar(GuardarCliente datos) {
        return new DatosCliente(datos.tipoDocumento(),
                Normalizador.documentoParaGuardar(datos.tipoDocumento(), datos.numeroDocumento()),
                texto(datos.nombres()), texto(datos.apellidos()), texto(datos.razonSocial()),
                Normalizador.telefono(datos.telefono()), Normalizador.email(texto(datos.email())),
                texto(datos.direccion()), texto(datos.ciudad()), datos.aceptaTratamientoDatos());
    }

    /** Nombres de los campos que cambian (nunca sus valores: son datos personales). */
    private static List<String> camposCambiados(Cliente actual, DatosCliente nuevos) {
        List<String> campos = new ArrayList<>();
        agregarSiCambia(campos, "tipoDocumento", actual.getTipoDocumento(), nuevos.tipoDocumento());
        agregarSiCambia(campos, "numeroDocumento", actual.getNumeroDocumento(), nuevos.numeroDocumento());
        if (nuevos.tipoDocumento() == TipoDocumento.NIT) {
            agregarSiCambia(campos, "razonSocial", actual.getRazonSocial(), nuevos.razonSocial());
        } else {
            agregarSiCambia(campos, "nombres", actual.getNombres(), nuevos.nombres());
            agregarSiCambia(campos, "apellidos", actual.getApellidos(), nuevos.apellidos());
        }
        agregarSiCambia(campos, "telefono", actual.getTelefono(), nuevos.telefono());
        agregarSiCambia(campos, "email", actual.getEmail(), nuevos.email());
        agregarSiCambia(campos, "direccion", actual.getDireccion(), nuevos.direccion());
        agregarSiCambia(campos, "ciudad", actual.getCiudad(), nuevos.ciudad());
        agregarSiCambia(campos, "aceptaTratamientoDatos", actual.isAceptaTratamientoDatos(),
                nuevos.aceptaTratamientoDatos());
        return campos;
    }

    private static void agregarSiCambia(List<String> campos, String campo, Object antes, Object despues) {
        if (!Objects.equals(antes, despues)) {
            campos.add(campo);
        }
    }

    /** Texto sin espacios alrededor; vacío se guarda como nulo. */
    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    private static ConflictException documentoDuplicado() {
        return new ConflictException(ErrorCode.DOCUMENTO_DUPLICADO, "Ya existe un cliente con ese documento");
    }
}
