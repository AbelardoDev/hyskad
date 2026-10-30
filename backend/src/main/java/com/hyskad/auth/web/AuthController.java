package com.hyskad.auth.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.auth.application.AuthService;
import com.hyskad.auth.application.AuthService.Sesion;
import com.hyskad.auth.application.CambiarPassword;
import com.hyskad.auth.application.Credenciales;
import com.hyskad.auth.application.Preferencias;
import com.hyskad.auth.application.RecuperacionPasswordService;
import com.hyskad.auth.application.RestablecerPassword;
import com.hyskad.auth.application.SolicitarRecuperacion;
import com.hyskad.auth.web.LimitadorIntentos.Regla;
import com.hyskad.auth.web.dto.SesionResponse;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.shared.validation.Normalizador;
import com.hyskad.usuarios.application.UsuarioSesion;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/** Autenticación y cuenta propia (RF2, RF35, IC3, IC6). */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final RecuperacionPasswordService recuperacion;
    private final LimitadorIntentos limitador;
    private final CookieRefresh cookie;
    private final UsuarioActual usuarioActual;

    public AuthController(AuthService authService, RecuperacionPasswordService recuperacion,
            LimitadorIntentos limitador, CookieRefresh cookie, UsuarioActual usuarioActual) {
        this.authService = authService;
        this.recuperacion = recuperacion;
        this.limitador = limitador;
        this.cookie = cookie;
        this.usuarioActual = usuarioActual;
    }

    @PostMapping("/login")
    public ResponseEntity<SesionResponse> login(@Valid @RequestBody Credenciales credenciales,
            HttpServletRequest request) {
        limitador.consumir(Regla.LOGIN, request.getRemoteAddr() + '|' + Normalizador.email(credenciales.email()));
        return conCookie(authService.login(credenciales.email(), credenciales.password()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<SesionResponse> refresh(
            @CookieValue(name = CookieRefresh.NOMBRE, required = false) String refreshToken,
            HttpServletRequest request) {
        limitador.consumir(Regla.REFRESH, request.getRemoteAddr());
        return conCookie(authService.refrescar(refreshToken));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            @CookieValue(name = CookieRefresh.NOMBRE, required = false) String refreshToken) {
        authService.logout(refreshToken);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie.borrada().toString()).build();
    }

    @GetMapping("/me")
    public UsuarioSesion me() {
        return authService.usuario(usuarioActual.idRequerido());
    }

    @PutMapping("/me/preferencias")
    public UsuarioSesion preferencias(@Valid @RequestBody Preferencias preferencias) {
        return authService.cambiarIdioma(usuarioActual.idRequerido(), preferencias.idioma());
    }

    @PostMapping("/password/cambiar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cambiarPassword(@Valid @RequestBody CambiarPassword datos) {
        Long usuarioId = usuarioActual.idRequerido();
        limitador.consumir(Regla.CAMBIAR_PASSWORD, String.valueOf(usuarioId));
        authService.cambiarPassword(usuarioId, datos.actual(), datos.nueva());
    }

    /** Siempre 202, exista o no el correo (RN-50). */
    @PostMapping("/password/olvide")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void olvide(@Valid @RequestBody SolicitarRecuperacion datos, HttpServletRequest request) {
        limitador.consumir(Regla.OLVIDE_PASSWORD, request.getRemoteAddr() + '|' + Normalizador.email(datos.email()));
        recuperacion.solicitar(datos.email());
    }

    @PostMapping("/password/restablecer")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void restablecer(@Valid @RequestBody RestablecerPassword datos, HttpServletRequest request) {
        limitador.consumir(Regla.RESTABLECER_PASSWORD, request.getRemoteAddr());
        recuperacion.restablecer(datos.token(), datos.nueva());
    }

    private ResponseEntity<SesionResponse> conCookie(Sesion sesion) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.con(sesion.refreshToken()).toString())
                .body(new SesionResponse(sesion.acceso().valor(), sesion.acceso().expiraEnSegundos(),
                        sesion.usuario()));
    }
}
