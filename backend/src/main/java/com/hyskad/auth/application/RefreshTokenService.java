package com.hyskad.auth.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Optional;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.auth.domain.RefreshToken;
import com.hyskad.auth.persistence.RefreshTokenRepository;
import com.hyskad.usuarios.domain.AccesoUsuarioModificado;

/**
 * Refresh tokens con rotación (IC3): cada uso revoca el token y emite otro. Si llega uno ya
 * revocado se asume robo y se revocan todos los del usuario (CP-05).
 */
@Service
public class RefreshTokenService {

    private final RefreshTokenRepository repository;
    private final AuthProperties propiedades;
    private final Clock clock;

    public RefreshTokenService(RefreshTokenRepository repository, AuthProperties propiedades, Clock clock) {
        this.repository = repository;
        this.propiedades = propiedades;
        this.clock = clock;
    }

    /** Crea un refresh token para el usuario y devuelve su valor en claro (solo viaja en la cookie). */
    @Transactional(propagation = Propagation.MANDATORY)
    public String emitir(Long usuarioId) {
        return crear(usuarioId).valor();
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ResultadoRotacion rotar(String valor) {
        Optional<RefreshToken> encontrado = repository.findByTokenHash(TokensOpacos.hash(valor));
        if (encontrado.isEmpty()) {
            return new ResultadoRotacion.Invalido();
        }
        RefreshToken actual = encontrado.get();
        Instant ahora = Instant.now(clock);
        if (actual.isRevocado()) {
            repository.revocarTodos(actual.getUsuarioId(), ahora);
            return new ResultadoRotacion.Reutilizado(actual.getUsuarioId());
        }
        if (actual.expiro(ahora)) {
            return new ResultadoRotacion.Invalido();
        }
        Creado nuevo = crear(actual.getUsuarioId());
        actual.reemplazarPor(nuevo.id(), ahora);
        return new ResultadoRotacion.Rotado(actual.getUsuarioId(), nuevo.valor());
    }

    /** Logout: revoca el token si existe y devuelve de quién era. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Optional<Long> revocar(String valor) {
        return repository.findByTokenHash(TokensOpacos.hash(valor)).map(token -> {
            token.revocar(Instant.now(clock));
            return token.getUsuarioId();
        });
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void revocarTodos(Long usuarioId) {
        repository.revocarTodos(usuarioId, Instant.now(clock));
    }

    /** RN-48: desactivación o cambio de permisos/rol, en la misma transacción que lo provocó. */
    @EventListener
    @Transactional(propagation = Propagation.MANDATORY)
    public void alModificarAcceso(AccesoUsuarioModificado evento) {
        revocarTodos(evento.usuarioId());
    }

    private Creado crear(Long usuarioId) {
        String valor = TokensOpacos.generar();
        Instant ahora = Instant.now(clock);
        RefreshToken token = repository.save(new RefreshToken(usuarioId, TokensOpacos.hash(valor), ahora,
                ahora.plus(propiedades.refreshVigencia())));
        return new Creado(token.getId(), valor);
    }

    private record Creado(Long id, String valor) {
    }

    public sealed interface ResultadoRotacion {

        record Rotado(Long usuarioId, String nuevoValor) implements ResultadoRotacion {

            @Override
            public String toString() {
                return "Rotado[usuarioId=" + usuarioId + "]";
            }
        }

        /** Token revocado presentado de nuevo: ya se revocaron todos los del usuario. */
        record Reutilizado(Long usuarioId) implements ResultadoRotacion {
        }

        record Invalido() implements ResultadoRotacion {
        }
    }
}
