package com.hyskad.usuarios.application;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.shared.validation.Normalizador;
import com.hyskad.usuarios.domain.AccesoUsuarioModificado;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.usuarios.domain.Usuario;
import com.hyskad.usuarios.persistence.UsuarioRepository;
import com.hyskad.usuarios.persistence.UsuarioSpecifications;

/**
 * Administración de usuarios (RF1–RF4): solo la usa quien tiene {@code USUARIOS_GESTIONAR}.
 * Aplica RN-46 (email único), RN-47 (siempre un admin activo; nadie se desactiva ni se cambia
 * permisos o rol a sí mismo) y RN-48 (al cambiar el acceso se publica {@link AccesoUsuarioModificado}).
 */
@Service
public class UsuarioService {

    static final String ENTIDAD = "usuario";

    private final UsuarioRepository repository;
    private final PermisoService permisoService;
    private final PasswordEncoder passwordEncoder;
    private final AuditoriaService auditoria;
    private final UsuarioActual usuarioActual;
    private final ApplicationEventPublisher eventos;

    public UsuarioService(UsuarioRepository repository, PermisoService permisoService, PasswordEncoder passwordEncoder,
            AuditoriaService auditoria, UsuarioActual usuarioActual, ApplicationEventPublisher eventos) {
        this.repository = repository;
        this.permisoService = permisoService;
        this.passwordEncoder = passwordEncoder;
        this.auditoria = auditoria;
        this.usuarioActual = usuarioActual;
        this.eventos = eventos;
    }

    @Transactional(readOnly = true)
    public Page<Usuario> listar(String texto, Rol rol, Boolean activo, Pageable pagina) {
        return repository.findAll(UsuarioSpecifications.filtrar(texto, rol, activo), pagina);
    }

    @Transactional(readOnly = true)
    public Usuario obtener(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
    }

    @Transactional
    public Usuario crear(CrearUsuario datos) {
        String email = Normalizador.email(datos.email());
        if (repository.existsByEmail(email)) {
            throw emailDuplicado();
        }
        String idioma = datos.idioma() == null ? DatosUsuario.IDIOMA_POR_DEFECTO : datos.idioma();
        Usuario usuario = repository.save(new Usuario(datos.nombre().trim(), email, vacioANulo(datos.telefono()),
                passwordEncoder.encode(datos.password()), datos.rol(), idioma, false));
        auditoria.registrar("USUARIO_CREADO", ENTIDAD, usuario.getId(), Map.of("rol", usuario.getRol().name()));
        return usuario;
    }

    @Transactional
    public Usuario actualizar(Long id, ActualizarUsuario datos) {
        Usuario usuario = obtener(id);
        String email = Normalizador.email(datos.email());
        if (repository.existsByEmailAndIdNot(email, id)) {
            throw emailDuplicado();
        }
        Rol rolAnterior = usuario.getRol();
        boolean cambiaRol = rolAnterior != datos.rol();
        if (cambiaRol) {
            if (usuario.esAdmin() && usuario.isActivo()) {
                verificarQueQuedaOtroAdmin(usuario);
            }
            verificarQueNoEsElUsuarioActual(usuario);
        }

        List<String> campos = new ArrayList<>();
        agregarSiCambia(campos, "nombre", usuario.getNombre(), datos.nombre().trim());
        agregarSiCambia(campos, "email", usuario.getEmail(), email);
        agregarSiCambia(campos, "telefono", usuario.getTelefono(), vacioANulo(datos.telefono()));
        agregarSiCambia(campos, "rol", rolAnterior, datos.rol());
        usuario.actualizarDatos(datos.nombre().trim(), email, vacioANulo(datos.telefono()), datos.rol());

        if (!campos.isEmpty()) {
            Map<String, Object> detalle = new LinkedHashMap<>();
            detalle.put("campos", campos);
            if (cambiaRol) {
                detalle.put("rolAnterior", rolAnterior.name());
                detalle.put("rolNuevo", datos.rol().name());
            }
            auditoria.registrar("USUARIO_ACTUALIZADO", ENTIDAD, id, detalle);
        }
        if (cambiaRol) {
            eventos.publishEvent(new AccesoUsuarioModificado(id));
        }
        return usuario;
    }

    @Transactional
    public Usuario cambiarEstado(Long id, boolean activo) {
        Usuario usuario = obtener(id);
        if (usuario.isActivo() == activo) {
            return usuario;
        }
        if (!activo && usuario.esAdmin()) {
            verificarQueQuedaOtroAdmin(usuario);
        }
        verificarQueNoEsElUsuarioActual(usuario);
        usuario.cambiarEstado(activo);
        auditoria.registrar(activo ? "USUARIO_ACTIVADO" : "USUARIO_DESACTIVADO", ENTIDAD, id, Map.of());
        if (!activo) {
            eventos.publishEvent(new AccesoUsuarioModificado(id));
        }
        return usuario;
    }

    @Transactional(readOnly = true)
    public List<PermisoDeUsuario> permisos(Long id) {
        Usuario usuario = obtener(id);
        return permisoService.detalle(usuario, esElUsuarioActual(usuario));
    }

    @Transactional
    public List<PermisoDeUsuario> actualizarPermisos(Long id, ActualizarPermisos datos) {
        Usuario usuario = obtener(id);
        verificarQueNoEsElUsuarioActual(usuario);
        permisoService.reemplazarAjustes(usuario, datos.ajustes());
        List<PermisoDeUsuario> resultado = permisoService.detalle(usuario, false);
        auditoria.registrar("PERMISOS_ACTUALIZADOS", ENTIDAD, id, Map.of(
                "concedidos", conAjuste(resultado, TipoAjuste.CONCEDIDO),
                "retirados", conAjuste(resultado, TipoAjuste.RETIRADO)));
        eventos.publishEvent(new AccesoUsuarioModificado(id));
        return resultado;
    }

    /** RN-47: debe quedar al menos otro administrador activo. Bloquea a los admins para evitar carreras. */
    private void verificarQueQuedaOtroAdmin(Usuario usuario) {
        boolean hayOtro = repository.bloquearAdminsActivos().stream()
                .anyMatch(admin -> !admin.getId().equals(usuario.getId()));
        if (!hayOtro) {
            throw new ConflictException(ErrorCode.ULTIMO_ADMIN, "Debe existir al menos un administrador activo");
        }
    }

    private void verificarQueNoEsElUsuarioActual(Usuario usuario) {
        if (esElUsuarioActual(usuario)) {
            throw new ConflictException(ErrorCode.AUTO_MODIFICACION,
                    "No puede cambiar su propio estado, rol ni permisos");
        }
    }

    private boolean esElUsuarioActual(Usuario usuario) {
        return usuarioActual.id().map(usuario.getId()::equals).orElse(false);
    }

    private static List<String> conAjuste(List<PermisoDeUsuario> permisos, TipoAjuste tipo) {
        return permisos.stream().filter(p -> p.ajuste() == tipo).map(p -> p.permiso().name()).toList();
    }

    private static void agregarSiCambia(List<String> campos, String campo, Object antes, Object despues) {
        if (!Objects.equals(antes, despues)) {
            campos.add(campo);
        }
    }

    private static String vacioANulo(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    private static ConflictException emailDuplicado() {
        return new ConflictException(ErrorCode.EMAIL_DUPLICADO, "Ya existe un usuario con ese email");
    }
}
