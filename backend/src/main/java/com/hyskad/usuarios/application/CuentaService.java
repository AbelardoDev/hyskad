package com.hyskad.usuarios.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.validation.Normalizador;
import com.hyskad.usuarios.application.ResultadoAutenticacion.Exitosa;
import com.hyskad.usuarios.application.ResultadoAutenticacion.Fallida;
import com.hyskad.usuarios.application.ResultadoAutenticacion.MotivoFallo;
import com.hyskad.usuarios.domain.Usuario;
import com.hyskad.usuarios.persistence.UsuarioRepository;

/**
 * Operaciones del propio usuario sobre su cuenta, que usa el módulo de autenticación: verificar
 * credenciales, consultar la sesión, cambiar contraseña e idioma. Expone {@link UsuarioSesion} y
 * nunca el hash de la contraseña.
 */
@Service
public class CuentaService {

    private final UsuarioRepository repository;
    private final PermisoService permisoService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    /**
     * Hash de un valor aleatorio: se compara contra él cuando el email no existe para que el tiempo
     * de respuesta no revele si la cuenta existe (RN-49).
     */
    private final String hashFicticio;

    public CuentaService(UsuarioRepository repository, PermisoService permisoService, PasswordEncoder passwordEncoder,
            Clock clock) {
        this.repository = repository;
        this.permisoService = permisoService;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.hashFicticio = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /** Verifica email y contraseña; si son válidos y el usuario está activo registra el acceso. */
    @Transactional
    public ResultadoAutenticacion autenticar(String email, String password) {
        Optional<Usuario> encontrado = repository.findByEmail(Normalizador.email(email));
        if (encontrado.isEmpty()) {
            passwordEncoder.matches(password, hashFicticio);
            return new Fallida(null, MotivoFallo.USUARIO_DESCONOCIDO);
        }
        Usuario usuario = encontrado.get();
        if (!passwordEncoder.matches(password, usuario.getPasswordHash())) {
            return new Fallida(usuario.getId(), MotivoFallo.PASSWORD_INCORRECTA);
        }
        if (!usuario.isActivo()) {
            return new Fallida(usuario.getId(), MotivoFallo.USUARIO_INACTIVO);
        }
        usuario.registrarAcceso(Instant.now(clock));
        return new Exitosa(sesion(usuario));
    }

    /** Sesión de un usuario si existe y sigue activo. */
    @Transactional(readOnly = true)
    public Optional<UsuarioSesion> sesionActiva(Long usuarioId) {
        return repository.findById(usuarioId).filter(Usuario::isActivo).map(this::sesion);
    }

    @Transactional(readOnly = true)
    public Optional<UsuarioSesion> sesionActivaPorEmail(String email) {
        return repository.findByEmail(Normalizador.email(email)).filter(Usuario::isActivo).map(this::sesion);
    }

    /** Cambio de contraseña por el propio usuario (ya validada con la política). */
    @Transactional
    public void cambiarPassword(Long usuarioId, String actual, String nueva) {
        Usuario usuario = activo(usuarioId);
        if (!passwordEncoder.matches(actual, usuario.getPasswordHash())) {
            throw new BusinessException(ErrorCode.PASSWORD_ACTUAL_INCORRECTA, "La contraseña actual no es correcta");
        }
        usuario.cambiarPassword(passwordEncoder.encode(nueva));
    }

    /** Nueva contraseña tras verificar un enlace de recuperación (RF35). */
    @Transactional
    public void restablecerPassword(Long usuarioId, String nueva) {
        activo(usuarioId).cambiarPassword(passwordEncoder.encode(nueva));
    }

    @Transactional
    public UsuarioSesion cambiarIdioma(Long usuarioId, String idioma) {
        Usuario usuario = activo(usuarioId);
        usuario.cambiarIdioma(idioma);
        return sesion(usuario);
    }

    private Usuario activo(Long usuarioId) {
        return repository.findById(usuarioId).filter(Usuario::isActivo)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESION_INVALIDA, "La sesión no es válida"));
    }

    private UsuarioSesion sesion(Usuario usuario) {
        return new UsuarioSesion(usuario.getId(), usuario.getNombre(), usuario.getEmail(), usuario.getRol(),
                permisoService.permisosEfectivos(usuario).stream().map(Enum::name).sorted().toList(),
                usuario.getIdioma(), usuario.isDebeCambiarPassword());
    }
}
