package com.hyskad.usuarios.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.usuarios.domain.Usuario;
import com.hyskad.usuarios.persistence.UsuarioRepository;

class AdminInicialRunnerTest {

    private UsuarioRepository repository;
    private PasswordEncoder encoder;
    private AuditoriaService auditoria;

    @BeforeEach
    void preparar() {
        repository = mock(UsuarioRepository.class);
        encoder = mock(PasswordEncoder.class);
        auditoria = mock(AuditoriaService.class);
        when(encoder.encode(anyString())).thenReturn("hash");
        when(repository.save(any(Usuario.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void siYaHayUnAdminNoHaceNada() {
        when(repository.existsByRol(Rol.ADMIN)).thenReturn(true);

        runner("admin@taller.co", "Clave12345").run(null);

        verify(repository, never()).save(any());
    }

    @ParameterizedTest
    @CsvSource(value = { "NULL,Clave12345", "'',Clave12345", "sin-arroba,Clave12345", "admin@taller.co,NULL",
        "admin@taller.co,''", "admin@taller.co,debil" }, nullValues = "NULL")
    void conVariablesFaltantesOInvalidasNoCreaNada(String email, String password) {
        runner(email, password).run(null);

        verify(repository, never()).save(any());
    }

    @Test
    void creaElAdminObligadoACambiarLaContrasena() {
        runner("  Admin@Taller.co ", "Clave12345").run(null);

        ArgumentCaptor<Usuario> creado = ArgumentCaptor.forClass(Usuario.class);
        verify(repository).save(creado.capture());
        assertThat(creado.getValue().getEmail()).isEqualTo("admin@taller.co");
        assertThat(creado.getValue().getRol()).isEqualTo(Rol.ADMIN);
        assertThat(creado.getValue().getPasswordHash()).isEqualTo("hash");
        assertThat(creado.getValue().isDebeCambiarPassword()).isTrue();
        assertThat(creado.getValue().isActivo()).isTrue();
        verify(auditoria).registrar(eq("USUARIO_CREADO"), eq("usuario"), any(), any());
    }

    private AdminInicialRunner runner(String email, String password) {
        return new AdminInicialRunner(repository, encoder, auditoria, email, password);
    }
}
