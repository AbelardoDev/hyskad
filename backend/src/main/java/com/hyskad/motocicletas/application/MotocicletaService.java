package com.hyskad.motocicletas.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.clientes.application.ClienteService;
import com.hyskad.clientes.application.ConsultaOrdenesActivas;
import com.hyskad.clientes.domain.Cliente;
import com.hyskad.motocicletas.domain.DatosMotocicleta;
import com.hyskad.motocicletas.domain.Motocicleta;
import com.hyskad.motocicletas.persistence.MotocicletaRepository;
import com.hyskad.motocicletas.persistence.MotocicletaSpecifications;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.validation.Normalizador;

/**
 * Motocicletas (RF7–RF9, RF29). Normaliza placa y VIN antes de guardar, aplica RN-41/RN-42
 * (únicos), RN-43 (cambio de propietario a un cliente activo) y RN-44 (no desactivar con órdenes
 * activas), y audita cada cambio.
 */
@Service
public class MotocicletaService {

    static final String ENTIDAD = "motocicleta";

    private final MotocicletaRepository repository;
    private final ClienteService clientes;
    private final ConsultaOrdenesActivas ordenesActivas;
    private final AuditoriaService auditoria;

    public MotocicletaService(MotocicletaRepository repository, ClienteService clientes,
            ConsultaOrdenesActivas ordenesActivas, AuditoriaService auditoria) {
        this.repository = repository;
        this.clientes = clientes;
        this.ordenesActivas = ordenesActivas;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public Page<Motocicleta> listar(String placa, String marca, String modelo, Long clienteId, Boolean activo,
            Pageable pagina) {
        return repository.findAll(MotocicletaSpecifications.filtrar(placa, marca, modelo, clienteId, activo), pagina);
    }

    /** Motos del cliente (activas e inactivas), por placa. */
    @Transactional(readOnly = true)
    public List<Motocicleta> delCliente(Long clienteId) {
        clientes.obtener(clienteId);
        return repository.findByClienteId(clienteId, Sort.by("placa"));
    }

    @Transactional(readOnly = true)
    public Motocicleta obtener(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
    }

    @Transactional
    public Motocicleta crear(CrearMotocicleta datos) {
        Cliente cliente = clientes.obtenerActivo(datos.clienteId());
        DatosMotocicleta ficha = normalizar(datos.placa(), datos.marca(), datos.modelo(), datos.anio(), datos.vin(),
                datos.cilindradaCc(), datos.color());
        if (repository.existsByPlaca(ficha.placa())) {
            throw placaDuplicada();
        }
        if (ficha.vin() != null && repository.existsByVin(ficha.vin())) {
            throw vinDuplicado();
        }
        Motocicleta moto = repository.save(new Motocicleta(cliente, ficha));
        auditoria.registrar("MOTOCICLETA_CREADA", ENTIDAD, moto.getId(), Map.of(
                "placa", moto.getPlaca(), "clienteId", cliente.getId()));
        return moto;
    }

    @Transactional
    public Motocicleta actualizar(Long id, ActualizarMotocicleta datos) {
        Motocicleta moto = obtener(id);
        DatosMotocicleta ficha = normalizar(datos.placa(), datos.marca(), datos.modelo(), datos.anio(), datos.vin(),
                datos.cilindradaCc(), datos.color());
        if (repository.existsByPlacaAndIdNot(ficha.placa(), id)) {
            throw placaDuplicada();
        }
        if (ficha.vin() != null && repository.existsByVinAndIdNot(ficha.vin(), id)) {
            throw vinDuplicado();
        }
        List<String> campos = camposCambiados(moto, ficha);
        moto.actualizar(ficha);
        if (!campos.isEmpty()) {
            auditoria.registrar("MOTOCICLETA_ACTUALIZADA", ENTIDAD, id, Map.of("campos", campos));
        }
        return moto;
    }

    @Transactional
    public Motocicleta cambiarEstado(Long id, boolean activo) {
        Motocicleta moto = obtener(id);
        if (moto.isActivo() == activo) {
            return moto;
        }
        if (!activo && ordenesActivas.tieneOrdenActiva(id)) {
            throw new ConflictException(ErrorCode.ORDENES_ACTIVAS,
                    "No se puede desactivar una moto con órdenes activas");
        }
        moto.cambiarEstado(activo);
        auditoria.registrar(activo ? "MOTOCICLETA_ACTIVADA" : "MOTOCICLETA_DESACTIVADA", ENTIDAD, id, Map.of());
        return moto;
    }

    /** RN-43: reasigna la moto a otro cliente activo; el historial se queda con la moto. */
    @Transactional
    public Motocicleta cambiarPropietario(Long id, Long clienteId) {
        Motocicleta moto = obtener(id);
        Long anterior = moto.getCliente().getId();
        if (anterior.equals(clienteId)) {
            return moto;
        }
        moto.cambiarPropietario(clientes.obtenerActivo(clienteId));
        auditoria.registrar("MOTOCICLETA_PROPIETARIO_CAMBIADO", ENTIDAD, id, Map.of(
                "clienteAnterior", anterior, "clienteNuevo", clienteId));
        return moto;
    }

    /** RF9: órdenes de la moto, la más reciente primero. Vacío hasta que exista {@code taller} (F09C). */
    @Transactional(readOnly = true)
    public List<HistorialServicio> historial(Long id) {
        obtener(id);
        return List.of();
    }

    private static DatosMotocicleta normalizar(String placa, String marca, String modelo, Integer anio, String vin,
            Integer cilindradaCc, String color) {
        return new DatosMotocicleta(Normalizador.placa(placa), marca.trim(), modelo.trim(), anio,
                Normalizador.vin(vin), cilindradaCc, color == null || color.isBlank() ? null : color.trim());
    }

    private static List<String> camposCambiados(Motocicleta actual, DatosMotocicleta nueva) {
        List<String> campos = new ArrayList<>();
        agregarSiCambia(campos, "placa", actual.getPlaca(), nueva.placa());
        agregarSiCambia(campos, "marca", actual.getMarca(), nueva.marca());
        agregarSiCambia(campos, "modelo", actual.getModelo(), nueva.modelo());
        agregarSiCambia(campos, "anio", actual.getAnio(), nueva.anio());
        agregarSiCambia(campos, "vin", actual.getVin(), nueva.vin());
        agregarSiCambia(campos, "cilindradaCc", actual.getCilindradaCc(), nueva.cilindradaCc());
        agregarSiCambia(campos, "color", actual.getColor(), nueva.color());
        return campos;
    }

    private static void agregarSiCambia(List<String> campos, String campo, Object antes, Object despues) {
        if (!Objects.equals(antes, despues)) {
            campos.add(campo);
        }
    }

    private static ConflictException placaDuplicada() {
        return new ConflictException(ErrorCode.PLACA_DUPLICADA, "Ya existe una moto con esa placa");
    }

    private static ConflictException vinDuplicado() {
        return new ConflictException(ErrorCode.VIN_DUPLICADO, "Ya existe una moto con ese VIN");
    }
}
