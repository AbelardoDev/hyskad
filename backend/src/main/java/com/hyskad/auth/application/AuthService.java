package com.hyskad.auth.application;

import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.auth.application.JwtService.TokenAcceso;
import com.hyskad.auth.application.RefreshTokenService.ResultadoRotacion;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.usuarios.application.CuentaService;
import com.hyskad.usuarios.application.ResultadoAutenticacion;
import com.hyskad.usuarios.application.UsuarioSesion;

/**
 * Login, refresh con rotación, logout y operaciones del usuario autenticado sobre su cuenta (RF2).
 * Login y refresh no revierten al fallar ({@code noRollbackFor}): la auditoría del intento fallido y
 * la revocación por reutilización de un token deben quedar guardadas aunque se responda 401.
 */
@Service
public class AuthService {

    private static final String ENTIDAD = "usuario";

    private final CuentaService cuentas;
    private final JwtService jwt;
    private final RefreshTokenService refreshTokens;
    private final AuditoriaService auditoria;

    public AuthService(CuentaService cuentas, JwtService jwt, RefreshTokenService refreshTokens,
            AuditoriaService auditoria) {
        this.cuentas = cuentas;
        this.jwt = jwt;
        this.refreshTokens = refreshTokens;
        this.auditoria = auditoria;
    }

    /** RN-49: cualquier fallo responde lo mismo, exista o no el correo y esté o no activo. */
    @Transactional(noRollbackFor = BusinessException.class)
    public Sesion login(String email, String password) {
        ResultadoAutenticacion resultado = cuentas.autenticar(email, password);
        if (resultado instanceof ResultadoAutenticacion.Fallida(Long usuarioId, var motivo)) {
            auditoria.registrarComo(null, "LOGIN_FALLIDO", ENTIDAD, usuarioId, Map.of("motivo", motivo.name()));
            throw new BusinessException(ErrorCode.CREDENCIALES_INVALIDAS, "Credenciales inválidas");
        }
        UsuarioSesion usuario = ((ResultadoAutenticacion.Exitosa) resultado).sesion();
        auditoria.registrarComo(usuario.id(), "LOGIN_EXITOSO", ENTIDAD, usuario.id(), Map.of());
        return iniciar(usuario, refreshTokens.emitir(usuario.id()));
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public Sesion refrescar(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw sesionInvalida();
        }
        return switch (refreshTokens.rotar(refreshToken)) {
            case ResultadoRotacion.Rotado(Long usuarioId, String nuevoValor) -> {
                UsuarioSesion usuario = cuentas.sesionActiva(usuarioId).orElse(null);
                if (usuario == null) {
                    refreshTokens.revocarTodos(usuarioId);
                    throw sesionInvalida();
                }
                yield iniciar(usuario, nuevoValor);
            }
            case ResultadoRotacion.Reutilizado(Long usuarioId) -> {
                auditoria.registrarComo(null, "REFRESH_REUTILIZADO", ENTIDAD, usuarioId, Map.of());
                throw sesionInvalida();
            }
            case ResultadoRotacion.Invalido() -> throw sesionInvalida();
        };
    }

    /** Revoca el refresh token si existe; sin cookie o con un token desconocido no hace nada. */
    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        refreshTokens.revocar(refreshToken).ifPresent(usuarioId ->
                auditoria.registrarComo(usuarioId, "LOGOUT", ENTIDAD, usuarioId, Map.of()));
    }

    @Transactional(readOnly = true)
    public UsuarioSesion usuario(Long usuarioId) {
        return cuentas.sesionActiva(usuarioId).orElseThrow(AuthService::sesionInvalida);
    }

    @Transactional
    public UsuarioSesion cambiarIdioma(Long usuarioId, String idioma) {
        return cuentas.cambiarIdioma(usuarioId, idioma);
    }

    @Transactional
    public void cambiarPassword(Long usuarioId, String actual, String nueva) {
        cuentas.cambiarPassword(usuarioId, actual, nueva);
        auditoria.registrar("PASSWORD_CAMBIADA", ENTIDAD, usuarioId, Map.of());
    }

    private Sesion iniciar(UsuarioSesion usuario, String refreshToken) {
        return new Sesion(jwt.emitir(usuario), refreshToken, usuario);
    }

    private static BusinessException sesionInvalida() {
        return new BusinessException(ErrorCode.SESION_INVALIDA, "La sesión no es válida o expiró");
    }

    /** Resultado de iniciar o renovar sesión. El refresh token solo viaja en la cookie. */
    public record Sesion(TokenAcceso acceso, String refreshToken, UsuarioSesion usuario) {

        @Override
        public String toString() {
            return "Sesion[usuarioId=" + usuario.id() + "]";
        }
    }
}
