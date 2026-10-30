package com.hyskad.auth.application;

import java.time.Clock;
import java.time.Instant;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import com.hyskad.shared.security.JwtConfig;
import com.hyskad.shared.security.JwtProperties;
import com.hyskad.usuarios.application.UsuarioSesion;

/** Emite el access token (JWT HS256, 15 min) con la identidad y los permisos efectivos del usuario. */
@Service
public class JwtService {

    private final JwtEncoder encoder;
    private final JwtProperties propiedades;
    private final Clock clock;

    public JwtService(JwtEncoder encoder, JwtProperties propiedades, Clock clock) {
        this.encoder = encoder;
        this.propiedades = propiedades;
        this.clock = clock;
    }

    public TokenAcceso emitir(UsuarioSesion usuario) {
        Instant ahora = Instant.now(clock);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(propiedades.issuer())
                .subject(String.valueOf(usuario.id()))
                .issuedAt(ahora)
                .expiresAt(ahora.plus(propiedades.vigencia()))
                .claim("email", usuario.email())
                .claim("nombre", usuario.nombre())
                .claim("rol", usuario.rol().name())
                .claim(JwtConfig.CLAIM_PERMISOS, usuario.permisos())
                .build();
        JwsHeader cabecera = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = encoder.encode(JwtEncoderParameters.from(cabecera, claims)).getTokenValue();
        return new TokenAcceso(token, propiedades.vigencia().toSeconds());
    }

    /** Access token y sus segundos de vigencia. */
    public record TokenAcceso(String valor, long expiraEnSegundos) {

        @Override
        public String toString() {
            return "TokenAcceso[expiraEnSegundos=" + expiraEnSegundos + "]";
        }
    }
}
