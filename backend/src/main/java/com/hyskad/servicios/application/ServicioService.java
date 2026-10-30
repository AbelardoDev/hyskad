package com.hyskad.servicios.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.servicios.domain.DatosServicio;
import com.hyskad.servicios.domain.Servicio;
import com.hyskad.servicios.persistence.ServicioRepository;
import com.hyskad.servicios.persistence.ServicioSpecifications;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;

/** Catálogo de servicios del taller (RF16): nombre único, baja lógica y auditoría. */
@Service
public class ServicioService {

    static final String ENTIDAD = "servicio";

    private final ServicioRepository repository;
    private final AuditoriaService auditoria;

    public ServicioService(ServicioRepository repository, AuditoriaService auditoria) {
        this.repository = repository;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public Page<Servicio> listar(String texto, Boolean activo, Pageable pagina) {
        return repository.findAll(ServicioSpecifications.filtrar(texto, activo), pagina);
    }

    @Transactional(readOnly = true)
    public Servicio obtener(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
    }

    @Transactional
    public Servicio crear(GuardarServicio datos) {
        DatosServicio normalizados = normalizar(datos);
        if (repository.existsByNombre(normalizados.nombre())) {
            throw duplicado();
        }
        Servicio servicio = repository.save(new Servicio(normalizados));
        auditoria.registrar("SERVICIO_CREADO", ENTIDAD, servicio.getId(), Map.of("nombre", servicio.getNombre()));
        return servicio;
    }

    @Transactional
    public Servicio actualizar(Long id, GuardarServicio datos) {
        Servicio servicio = obtener(id);
        DatosServicio nuevos = normalizar(datos);
        if (repository.existsByNombreAndIdNot(nuevos.nombre(), id)) {
            throw duplicado();
        }
        List<String> campos = camposCambiados(servicio, nuevos);
        servicio.actualizar(nuevos);
        if (!campos.isEmpty()) {
            auditoria.registrar("SERVICIO_ACTUALIZADO", ENTIDAD, id, Map.of("campos", campos));
        }
        return servicio;
    }

    @Transactional
    public Servicio cambiarEstado(Long id, boolean activo) {
        Servicio servicio = obtener(id);
        if (servicio.isActivo() != activo) {
            servicio.cambiarEstado(activo);
            auditoria.registrar(activo ? "SERVICIO_ACTIVADO" : "SERVICIO_DESACTIVADO", ENTIDAD, id, Map.of());
        }
        return servicio;
    }

    private static DatosServicio normalizar(GuardarServicio datos) {
        String descripcion = datos.descripcion() == null || datos.descripcion().isBlank() ? null
                : datos.descripcion().trim();
        return new DatosServicio(datos.nombre().trim(), descripcion, datos.precioBase(), datos.tiempoEstimadoMin());
    }

    private static List<String> camposCambiados(Servicio actual, DatosServicio nuevos) {
        List<String> campos = new ArrayList<>();
        agregarSiCambia(campos, "nombre", actual.getNombre(), nuevos.nombre());
        agregarSiCambia(campos, "descripcion", actual.getDescripcion(), nuevos.descripcion());
        if (actual.getPrecioBase().compareTo(nuevos.precioBase()) != 0) {
            campos.add("precioBase");
        }
        agregarSiCambia(campos, "tiempoEstimadoMin", actual.getTiempoEstimadoMin(), nuevos.tiempoEstimadoMin());
        return campos;
    }

    private static void agregarSiCambia(List<String> campos, String campo, Object antes, Object despues) {
        if (!Objects.equals(antes, despues)) {
            campos.add(campo);
        }
    }

    private static ConflictException duplicado() {
        return new ConflictException(ErrorCode.SERVICIO_DUPLICADO, "Ya existe un servicio con ese nombre");
    }
}
