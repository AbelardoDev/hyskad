package com.hyskad.support;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.boot.test.context.TestComponent;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.hyskad.auth.application.JwtService;
import com.hyskad.usuarios.application.CuentaService;
import com.hyskad.usuarios.domain.Rol;

/**
 * Crea usuarios directamente en la BD (con un hash BCrypt calculado una sola vez) y emite access
 * tokens reales para ellos, sin pasar por el login ni por su rate limiting.
 */
@TestComponent
public class UsuariosDePrueba {

    public static final String PASSWORD = "Clave12345";
    private static final String HASH = BCrypt.hashpw(PASSWORD, BCrypt.gensalt(12));

    private final JdbcTemplate jdbc;
    private final JwtService jwtService;
    private final CuentaService cuentas;

    public UsuariosDePrueba(JdbcTemplate jdbc, JwtService jwtService, CuentaService cuentas) {
        this.jdbc = jdbc;
        this.jwtService = jwtService;
        this.cuentas = cuentas;
    }

    public Creado crear(Rol rol) {
        return crear(rol, true, "es");
    }

    public Creado crear(Rol rol, boolean activo, String idioma) {
        String email = rol.name().toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8) + "@prueba.test";
        KeyHolder llave = new GeneratedKeyHolder();
        jdbc.update(conexion -> {
            PreparedStatement ps = conexion.prepareStatement("insert into usuario (nombre, email, password_hash, rol, "
                    + "activo, idioma, created_at, updated_at) values (?, ?, ?, ?, ?, ?, utc_timestamp(6), "
                    + "utc_timestamp(6))", Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, "Prueba " + rol);
            ps.setString(2, email);
            ps.setString(3, HASH);
            ps.setString(4, rol.name());
            ps.setBoolean(5, activo);
            ps.setString(6, idioma);
            return ps;
        }, llave);
        return new Creado(llave.getKey().longValue(), email);
    }

    /** Cabecera {@code Authorization} con un access token vigente del usuario (debe estar activo). */
    public String bearer(Long usuarioId) {
        return "Bearer " + jwtService.emitir(cuentas.sesionActiva(usuarioId).orElseThrow()).valor();
    }

    /** IP distinta por prueba para que el rate limiting de una no afecte a otra. */
    public static RequestPostProcessor ipUnica() {
        ThreadLocalRandom azar = ThreadLocalRandom.current();
        String ip = "10." + azar.nextInt(256) + "." + azar.nextInt(256) + "." + azar.nextInt(1, 255);
        return peticion -> {
            peticion.setRemoteAddr(ip);
            return peticion;
        };
    }

    public record Creado(Long id, String email) {
    }
}
