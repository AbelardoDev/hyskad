package com.hyskad.proveedores.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.proveedores.domain.DatosProveedor;
import com.hyskad.proveedores.domain.Proveedor;
import com.hyskad.proveedores.persistence.ProveedorRepository;
import com.hyskad.proveedores.persistence.ProveedorSpecifications;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.validation.Normalizador;

/** Proveedores (RF20): documento único por tipo (RN-40), baja lógica y auditoría. */
@Service
public class ProveedorService {

    static final String ENTIDAD = "proveedor";

    private final ProveedorRepository repository;
    private final AuditoriaService auditoria;

    public ProveedorService(ProveedorRepository repository, AuditoriaService auditoria) {
        this.repository = repository;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public Page<Proveedor> listar(String texto, Boolean activo, Pageable pagina) {
        return repository.findAll(ProveedorSpecifications.filtrar(texto, activo), pagina);
    }

    @Transactional(readOnly = true)
    public Proveedor obtener(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
    }

    /** RN-16: solo a proveedores activos se les registran compras. */
    @Transactional(readOnly = true)
    public Proveedor obtenerActivo(Long id) {
        Proveedor proveedor = obtener(id);
        if (!proveedor.isActivo()) {
            throw new ConflictException(ErrorCode.PROVEEDOR_INACTIVO, "El proveedor está inactivo",
                    Map.of("proveedorId", id));
        }
        return proveedor;
    }

    @Transactional
    public Proveedor crear(GuardarProveedor datos) {
        DatosProveedor normalizados = normalizar(datos);
        if (repository.existsByTipoDocumentoAndNumeroDocumento(normalizados.tipoDocumento(),
                normalizados.numeroDocumento())) {
            throw documentoDuplicado();
        }
        Proveedor proveedor = repository.save(new Proveedor(normalizados));
        auditoria.registrar("PROVEEDOR_CREADO", ENTIDAD, proveedor.getId(),
                Map.of("tipoDocumento", proveedor.getTipoDocumento().name()));
        return proveedor;
    }

    @Transactional
    public Proveedor actualizar(Long id, GuardarProveedor datos) {
        Proveedor proveedor = obtener(id);
        DatosProveedor nuevos = normalizar(datos);
        if (repository.existsByTipoDocumentoAndNumeroDocumentoAndIdNot(nuevos.tipoDocumento(),
                nuevos.numeroDocumento(), id)) {
            throw documentoDuplicado();
        }
        List<String> campos = camposCambiados(proveedor, nuevos);
        proveedor.actualizar(nuevos);
        if (!campos.isEmpty()) {
            auditoria.registrar("PROVEEDOR_ACTUALIZADO", ENTIDAD, id, Map.of("campos", campos));
        }
        return proveedor;
    }

    @Transactional
    public Proveedor cambiarEstado(Long id, boolean activo) {
        Proveedor proveedor = obtener(id);
        if (proveedor.isActivo() != activo) {
            proveedor.cambiarEstado(activo);
            auditoria.registrar(activo ? "PROVEEDOR_ACTIVADO" : "PROVEEDOR_DESACTIVADO", ENTIDAD, id, Map.of());
        }
        return proveedor;
    }

    private static DatosProveedor normalizar(GuardarProveedor datos) {
        return new DatosProveedor(datos.tipoDocumento(),
                Normalizador.documentoParaGuardar(datos.tipoDocumento(), datos.numeroDocumento()),
                datos.razonSocial().trim(), texto(datos.contacto()),
                datos.telefono() == null || datos.telefono().isBlank() ? null : Normalizador.telefono(datos.telefono()),
                Normalizador.email(texto(datos.email())), texto(datos.direccion()));
    }

    private static List<String> camposCambiados(Proveedor actual, DatosProveedor nuevos) {
        List<String> campos = new ArrayList<>();
        agregarSiCambia(campos, "tipoDocumento", actual.getTipoDocumento(), nuevos.tipoDocumento());
        agregarSiCambia(campos, "numeroDocumento", actual.getNumeroDocumento(), nuevos.numeroDocumento());
        agregarSiCambia(campos, "razonSocial", actual.getRazonSocial(), nuevos.razonSocial());
        agregarSiCambia(campos, "contacto", actual.getContacto(), nuevos.contacto());
        agregarSiCambia(campos, "telefono", actual.getTelefono(), nuevos.telefono());
        agregarSiCambia(campos, "email", actual.getEmail(), nuevos.email());
        agregarSiCambia(campos, "direccion", actual.getDireccion(), nuevos.direccion());
        return campos;
    }

    private static void agregarSiCambia(List<String> campos, String campo, Object antes, Object despues) {
        if (!Objects.equals(antes, despues)) {
            campos.add(campo);
        }
    }

    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    private static ConflictException documentoDuplicado() {
        return new ConflictException(ErrorCode.DOCUMENTO_DUPLICADO, "Ya existe un proveedor con ese documento");
    }
}
