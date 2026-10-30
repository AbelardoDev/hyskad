package com.hyskad.usuarios.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.usuarios.domain.Permiso;
import com.hyskad.usuarios.domain.PermisosPorRol;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.usuarios.domain.Usuario;
import com.hyskad.usuarios.domain.UsuarioPermiso;
import com.hyskad.usuarios.persistence.UsuarioPermisoRepository;

class PermisoServiceTest {

    private static final Instant AHORA = Instant.parse("2026-10-29T12:00:00Z");

    private UsuarioPermisoRepository repository;
    private PermisoService service;

    @BeforeEach
    void preparar() {
        repository = mock(UsuarioPermisoRepository.class);
        service = new PermisoService(repository, Clock.fixed(AHORA, ZoneOffset.UTC));
    }

    @Test
    void sinAjustesLosPermisosSonLosDelRol() {
        assertThat(PermisoService.calcular(Rol.MECANICO, Map.of()))
                .containsExactlyInAnyOrderElementsOf(PermisosPorRol.de(Rol.MECANICO));
    }

    @Test
    void elAdminTieneTodosLosPermisosYLosDemasNingunoSoloAdmin() {
        assertThat(PermisosPorRol.de(Rol.ADMIN)).containsExactlyInAnyOrder(Permiso.values());
        for (Rol rol : List.of(Rol.ALMACEN, Rol.VENDEDOR, Rol.MECANICO)) {
            assertThat(PermisosPorRol.de(rol)).noneMatch(Permiso::isSoloAdmin);
        }
    }

    @Test
    void laTablaDeRolesCoincideConArchitecture() {
        assertThat(PermisosPorRol.de(Rol.MECANICO)).containsExactlyInAnyOrder(Permiso.DASHBOARD_VER,
                Permiso.CLIENTES_VER, Permiso.MOTOS_VER, Permiso.PRODUCTOS_VER, Permiso.ORDENES_VER_ASIGNADAS,
                Permiso.ORDENES_TRABAJAR);
        assertThat(PermisosPorRol.de(Rol.ALMACEN)).contains(Permiso.INVENTARIO_AJUSTAR, Permiso.COMPRAS_GESTIONAR)
                .doesNotContain(Permiso.VENTAS_CREAR, Permiso.CLIENTES_VER);
        assertThat(PermisosPorRol.de(Rol.VENDEDOR)).contains(Permiso.VENTAS_CREAR, Permiso.PAGOS_REGISTRAR)
                .doesNotContain(Permiso.VENTAS_ANULAR, Permiso.SERVICIOS_GESTIONAR, Permiso.ORDENES_VER_ASIGNADAS);
        assertThat(EnumSet.of(Permiso.USUARIOS_GESTIONAR, Permiso.CONFIGURACION_GESTIONAR, Permiso.AUDITORIA_VER))
                .allMatch(Permiso::isSoloAdmin);
    }

    @Test
    void sumaLosConcedidosYQuitaLosRetirados() {
        Set<Permiso> efectivos = PermisoService.calcular(Rol.VENDEDOR,
                Map.of(Permiso.VENTAS_ANULAR, true, Permiso.VENTAS_CREAR, false));

        assertThat(efectivos).contains(Permiso.VENTAS_ANULAR).doesNotContain(Permiso.VENTAS_CREAR);
        assertThat(efectivos).hasSize(PermisosPorRol.de(Rol.VENDEDOR).size());
    }

    @Test
    void retirarUnPermisoQueElRolNoTraeNoCambiaNada() {
        assertThat(PermisoService.calcular(Rol.MECANICO, Map.of(Permiso.VENTAS_CREAR, false)))
                .containsExactlyInAnyOrderElementsOf(PermisosPorRol.de(Rol.MECANICO));
    }

    @Test
    void unPermisoSoloAdminGuardadoNoSeSumaAOtroRol() {
        assertThat(PermisoService.calcular(Rol.ALMACEN, Map.of(Permiso.USUARIOS_GESTIONAR, true)))
                .doesNotContain(Permiso.USUARIOS_GESTIONAR);
    }

    @Test
    void alAdminSeLePuedenRetirarPermisosSoloAdmin() {
        assertThat(PermisoService.calcular(Rol.ADMIN, Map.of(Permiso.AUDITORIA_VER, false)))
                .doesNotContain(Permiso.AUDITORIA_VER).contains(Permiso.USUARIOS_GESTIONAR);
    }

    @Test
    void permisosEfectivosLeeLosAjustesDelUsuario() {
        Usuario vendedor = usuario(7L, Rol.VENDEDOR);
        when(repository.findByUsuarioId(7L)).thenReturn(
                List.of(new UsuarioPermiso(7L, Permiso.VENTAS_CREAR, false, AHORA)));

        assertThat(service.permisosEfectivos(vendedor)).doesNotContain(Permiso.VENTAS_CREAR);
    }

    @Test
    void detalleMarcaOrigenAjusteYEditable() {
        Usuario vendedor = usuario(7L, Rol.VENDEDOR);
        when(repository.findByUsuarioId(7L)).thenReturn(List.of(
                new UsuarioPermiso(7L, Permiso.VENTAS_CREAR, false, AHORA),
                new UsuarioPermiso(7L, Permiso.VENTAS_ANULAR, true, AHORA)));

        Map<Permiso, PermisoDeUsuario> detalle = service.detalle(vendedor, false).stream()
                .collect(Collectors.toMap(PermisoDeUsuario::permiso, p -> p));

        assertThat(detalle).hasSize(Permiso.values().length);
        assertThat(detalle.get(Permiso.VENTAS_CREAR))
                .isEqualTo(new PermisoDeUsuario(Permiso.VENTAS_CREAR, true, TipoAjuste.RETIRADO, false, true, false));
        assertThat(detalle.get(Permiso.VENTAS_ANULAR))
                .isEqualTo(new PermisoDeUsuario(Permiso.VENTAS_ANULAR, false, TipoAjuste.CONCEDIDO, true, true, false));
        assertThat(detalle.get(Permiso.USUARIOS_GESTIONAR).editable()).isFalse();
        assertThat(detalle.get(Permiso.CLIENTES_VER).ajuste()).isNull();
    }

    @Test
    void enElDetalleDelPropioUsuarioNadaEsEditable() {
        Usuario admin = usuario(1L, Rol.ADMIN);
        when(repository.findByUsuarioId(1L)).thenReturn(List.of());

        assertThat(service.detalle(admin, true)).noneMatch(PermisoDeUsuario::editable);
    }

    @Test
    @SuppressWarnings("unchecked")
    void reemplazarGuardaSoloLosAjustesQueCambianAlgo() {
        Usuario vendedor = usuario(7L, Rol.VENDEDOR);

        service.reemplazarAjustes(vendedor, List.of(
                new AjustePermiso(Permiso.VENTAS_CREAR, false),
                new AjustePermiso(Permiso.CLIENTES_VER, true),
                new AjustePermiso(Permiso.INVENTARIO_AJUSTAR, false),
                new AjustePermiso(Permiso.VENTAS_ANULAR, true)));

        verify(repository).eliminarDeUsuario(7L);
        ArgumentCaptor<List<UsuarioPermiso>> guardados = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(guardados.capture());
        assertThat(guardados.getValue())
                .extracting(UsuarioPermiso::getPermiso, UsuarioPermiso::isConcedido, UsuarioPermiso::getCreatedAt)
                .containsExactlyInAnyOrder(
                        tuple(Permiso.VENTAS_CREAR, false, AHORA),
                        tuple(Permiso.VENTAS_ANULAR, true, AHORA));
    }

    @Test
    void noSeConcedeUnPermisoSoloAdminAOtroRol() {
        Usuario almacen = usuario(9L, Rol.ALMACEN);

        assertThatThrownBy(() -> service.reemplazarAjustes(almacen,
                List.of(new AjustePermiso(Permiso.CONFIGURACION_GESTIONAR, true))))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getCode()).isEqualTo(ErrorCode.PERMISO_SOLO_ADMIN);
        verify(repository, never()).eliminarDeUsuario(anyLong());
    }

    private static Usuario usuario(Long id, Rol rol) {
        Usuario usuario = new Usuario("Prueba", "p@prueba.test", null, "hash", rol, "es", false);
        ReflectionTestUtils.setField(usuario, "id", id);
        return usuario;
    }
}
