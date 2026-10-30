package com.hyskad.auth.web.dto;

import com.hyskad.usuarios.application.UsuarioSesion;

/** Respuesta de login y refresh. El refresh token va solo en la cookie, nunca en el cuerpo. */
public record SesionResponse(String accessToken, long expiresIn, UsuarioSesion usuario) {
}
