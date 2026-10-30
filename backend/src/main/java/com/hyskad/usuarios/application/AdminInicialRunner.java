package com.hyskad.usuarios.application;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.validation.Normalizador;
import com.hyskad.shared.validation.PasswordSeguraValidator;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.usuarios.domain.Usuario;
import com.hyskad.usuarios.persistence.UsuarioRepository;

/**
 * RN-46: si no existe ningún administrador, crea el primero con {@code ADMIN_EMAIL} y
 * {@code ADMIN_PASSWORD}, obligado a cambiar la contraseña en su primer ingreso. Si faltan las
 * variables o la contraseña no cumple la política, registra el error y no crea nada.
 */
@Component
public class AdminInicialRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminInicialRunner.class);
    static final String NOMBRE = "Administrador";

    private final UsuarioRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final AuditoriaService auditoria;
    private final String email;
    private final String password;

    public AdminInicialRunner(UsuarioRepository repository, PasswordEncoder passwordEncoder,
            AuditoriaService auditoria, @Value("${hyskad.admin.email:}") String email,
            @Value("${hyskad.admin.password:}") String password) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.auditoria = auditoria;
        this.email = email;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (repository.existsByRol(Rol.ADMIN)) {
            return;
        }
        if (email == null || email.isBlank() || !email.contains("@") || password == null || password.isBlank()) {
            log.error("No existe ningún administrador y faltan ADMIN_EMAIL/ADMIN_PASSWORD válidos: "
                    + "no se creó el administrador inicial. Defínalas y reinicie la aplicación.");
            return;
        }
        if (!PasswordSeguraValidator.esSegura(password)) {
            log.error("ADMIN_PASSWORD no cumple la política (mínimo 8 caracteres, con letras y números): "
                    + "no se creó el administrador inicial.");
            return;
        }
        Usuario admin = repository.save(new Usuario(NOMBRE, Normalizador.email(email), null,
                passwordEncoder.encode(password), Rol.ADMIN, "es", true));
        auditoria.registrar("USUARIO_CREADO", UsuarioService.ENTIDAD, admin.getId(),
                Map.of("rol", Rol.ADMIN.name(), "origen", "ADMIN_INICIAL"));
        log.info("Se creó el administrador inicial (id {}); debe cambiar la contraseña al ingresar", admin.getId());
    }
}
