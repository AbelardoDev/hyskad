package com.hyskad.auth.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.auth.domain.TokenRecuperacion;
import com.hyskad.auth.persistence.TokenRecuperacionRepository;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.usuarios.application.CuentaService;

/**
 * Recuperación de contraseña (RF35, RN-50): la solicitud no revela si el correo existe; el enlace
 * vale 30 min y un solo uso; pedir otro invalida los anteriores y restablecer cierra todas las
 * sesiones. El correo sale después de confirmar la transacción ({@link RecuperacionSolicitada}).
 */
@Service
public class RecuperacionPasswordService {

    private static final String ENTIDAD = "usuario";

    private final TokenRecuperacionRepository repository;
    private final CuentaService cuentas;
    private final RefreshTokenService refreshTokens;
    private final AuditoriaService auditoria;
    private final ApplicationEventPublisher eventos;
    private final AuthProperties propiedades;
    private final Clock clock;

    public RecuperacionPasswordService(TokenRecuperacionRepository repository, CuentaService cuentas,
            RefreshTokenService refreshTokens, AuditoriaService auditoria, ApplicationEventPublisher eventos,
            AuthProperties propiedades, Clock clock) {
        this.repository = repository;
        this.cuentas = cuentas;
        this.refreshTokens = refreshTokens;
        this.auditoria = auditoria;
        this.eventos = eventos;
        this.propiedades = propiedades;
        this.clock = clock;
    }

    @Transactional
    public void solicitar(String email) {
        cuentas.sesionActivaPorEmail(email).ifPresent(usuario -> {
            Instant ahora = Instant.now(clock);
            repository.invalidarPendientes(usuario.id(), ahora);
            String valor = TokensOpacos.generar();
            repository.save(new TokenRecuperacion(usuario.id(), TokensOpacos.hash(valor), ahora,
                    ahora.plus(propiedades.recuperacionVigencia())));
            auditoria.registrarComo(null, "RECUPERACION_SOLICITADA", ENTIDAD, usuario.id(), Map.of());
            eventos.publishEvent(new RecuperacionSolicitada(usuario.email(), usuario.nombre(), usuario.idioma(),
                    valor, propiedades.recuperacionVigencia().toMinutes()));
        });
    }

    @Transactional
    public void restablecer(String token, String nueva) {
        Instant ahora = Instant.now(clock);
        TokenRecuperacion recuperacion = repository.findByTokenHash(TokensOpacos.hash(token))
                .filter(t -> t.esUsable(ahora))
                .filter(t -> cuentas.sesionActiva(t.getUsuarioId()).isPresent())
                .orElseThrow(() -> new BusinessException(ErrorCode.TOKEN_INVALIDO,
                        "El enlace de recuperación no es válido o ya expiró"));
        recuperacion.usar(ahora);
        cuentas.restablecerPassword(recuperacion.getUsuarioId(), nueva);
        refreshTokens.revocarTodos(recuperacion.getUsuarioId());
        auditoria.registrarComo(recuperacion.getUsuarioId(), "PASSWORD_RESTABLECIDA", ENTIDAD,
                recuperacion.getUsuarioId(), Map.of());
    }
}
