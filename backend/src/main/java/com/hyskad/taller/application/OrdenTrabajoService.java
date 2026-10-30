package com.hyskad.taller.application;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.clientes.application.ClienteService;
import com.hyskad.clientes.domain.Cliente;
import com.hyskad.motocicletas.application.MotocicletaService;
import com.hyskad.motocicletas.domain.Motocicleta;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.shared.consecutivo.ConsecutivoService;
import com.hyskad.shared.consecutivo.TipoConsecutivo;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCampo;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.taller.domain.Asignacion;
import com.hyskad.taller.domain.DatosDiagnostico;
import com.hyskad.taller.domain.DatosRecepcion;
import com.hyskad.taller.domain.EstadoOrden;
import com.hyskad.taller.domain.EstadoOrdenCambiado;
import com.hyskad.taller.domain.MecanicoAsignado;
import com.hyskad.taller.domain.OrdenCreada;
import com.hyskad.taller.domain.OrdenTrabajo;
import com.hyskad.taller.domain.OrdenTrabajo.CambioMecanicos;
import com.hyskad.taller.persistence.OrdenTrabajoRepository;
import com.hyskad.taller.persistence.OrdenTrabajoSpecifications;
import com.hyskad.usuarios.application.UsuarioService;
import com.hyskad.usuarios.domain.Permiso;
import com.hyskad.usuarios.domain.Usuario;

/**
 * Órdenes de trabajo (RF10–RF14): recepción, asignación, diagnóstico y transiciones de estado.
 * Orquesta las condiciones de cada transición sobre la máquina de estados de {@link EstadoOrden}.
 * RN-27: quien no tiene {@code ORDENES_VER_TODAS} solo ve y opera las órdenes que tiene
 * asignadas; para las demás responde 404, sin revelar que existen. Toda modificación recibe la
 * {@code version} que leyó el cliente y responde 409 si otro la cambió antes.
 */
@Service
public class OrdenTrabajoService {

    static final String ENTIDAD = "orden_trabajo";
    static final int MAX_KILOMETRAJE = 9_999_999;
    static final int MAX_MECANICOS = 10;

    private final OrdenTrabajoRepository repository;
    private final ClienteService clientes;
    private final MotocicletaService motocicletas;
    private final UsuarioService usuarios;
    private final ConsecutivoService consecutivos;
    private final AuditoriaService auditoria;
    private final UsuarioActual usuarioActual;
    private final ApplicationEventPublisher eventos;
    private final Clock clock;

    public OrdenTrabajoService(OrdenTrabajoRepository repository, ClienteService clientes,
            MotocicletaService motocicletas, UsuarioService usuarios, ConsecutivoService consecutivos,
            AuditoriaService auditoria, UsuarioActual usuarioActual, ApplicationEventPublisher eventos, Clock clock) {
        this.repository = repository;
        this.clientes = clientes;
        this.motocicletas = motocicletas;
        this.usuarios = usuarios;
        this.consecutivos = consecutivos;
        this.auditoria = auditoria;
        this.usuarioActual = usuarioActual;
        this.eventos = eventos;
        this.clock = clock;
    }

    /** Tablero: todas las órdenes o, sin {@code ORDENES_VER_TODAS}, solo las asignadas (RN-27). */
    @Transactional(readOnly = true)
    public Page<OrdenTrabajo> listar(FiltroOrdenes filtro, Pageable pagina) {
        Specification<OrdenTrabajo> visibles = puedeVerTodas() ? especificacion(filtro)
                : especificacion(filtro).and(OrdenTrabajoSpecifications.asignadaA(usuarioActual.idRequerido()));
        return conMecanicos(repository.findAll(visibles, pagina));
    }

    /** "Mis órdenes": las asignadas al usuario actual, tenga o no permiso de ver todas. */
    @Transactional(readOnly = true)
    public Page<OrdenTrabajo> mias(FiltroOrdenes filtro, Pageable pagina) {
        return conMecanicos(repository.findAll(
                especificacion(filtro).and(OrdenTrabajoSpecifications.asignadaA(usuarioActual.idRequerido())), pagina));
    }

    /** Conteo por estado de las órdenes visibles para el usuario, con todos los estados (en 0 si no hay). */
    @Transactional(readOnly = true)
    public Map<EstadoOrden, Long> resumenEstados() {
        Map<EstadoOrden, Long> conteo = new EnumMap<>(EstadoOrden.class);
        for (EstadoOrden estado : EstadoOrden.values()) {
            conteo.put(estado, 0L);
        }
        (puedeVerTodas() ? repository.contarPorEstado()
                : repository.contarPorEstadoDelMecanico(usuarioActual.idRequerido()))
                .forEach(c -> conteo.put(c.getEstado(), c.getCantidad()));
        return conteo;
    }

    /** Detalle con mecánicos, historial y lo que el usuario actual puede hacer con la orden. */
    @Transactional(readOnly = true)
    public DetalleOrden detalle(Long id) {
        OrdenTrabajo orden = repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
        exigirVisible(orden);
        cargar(orden);
        return new DetalleOrden(orden, acciones(orden));
    }

    /**
     * Lo que la recepción necesita saber de una moto antes de crear la orden: la última lectura de
     * kilometraje (RN-25) y su orden activa, si tiene (RN-24).
     */
    @Transactional(readOnly = true)
    public InfoRecepcion recepcion(Long motocicletaId) {
        motocicletas.obtener(motocicletaId);
        OrdenActiva activa = repository.findFirstByMotocicletaIdAndEstadoIn(motocicletaId, EstadoOrden.activos())
                .map(o -> new OrdenActiva(o.getId(), o.getNumero(), o.getEstado())).orElse(null);
        return new InfoRecepcion(ultimoKilometraje(motocicletaId), activa);
    }

    /**
     * RN-24 y RN-25: cliente activo, moto activa de ese cliente y sin otra orden activa, y
     * kilometraje no menor al último registrado. Numera la orden ({@code OT-000001}), la deja
     * {@code RECIBIDA} y asigna los mecánicos que vengan.
     */
    @Transactional
    public OrdenTrabajo crear(CrearOrden datos) {
        Cliente cliente = clientes.obtenerActivo(datos.clienteId());
        Motocicleta moto = motocicletas.obtener(datos.motocicletaId());
        if (!moto.isActivo()) {
            throw new ConflictException(ErrorCode.MOTO_INACTIVA, "La motocicleta está inactiva",
                    Map.of("motocicletaId", moto.getId()));
        }
        if (!Objects.equals(moto.getCliente().getId(), cliente.getId())) {
            throw new BusinessException(ErrorCode.MOTO_NO_PERTENECE_CLIENTE,
                    "La motocicleta no pertenece al cliente", Map.of("motocicletaId", moto.getId()));
        }
        Optional<OrdenTrabajo> activa = repository.findFirstByMotocicletaIdAndEstadoIn(moto.getId(),
                EstadoOrden.activos());
        if (activa.isPresent()) {
            throw new ConflictException(ErrorCode.MOTO_CON_ORDEN_ACTIVA, "La motocicleta ya tiene una orden activa",
                    Map.of("ordenId", activa.get().getId(), "numero", activa.get().getNumero()));
        }
        Integer ultimo = ultimoKilometraje(moto.getId());
        if (ultimo != null && datos.kilometrajeIngreso() < ultimo) {
            throw BusinessException.validacion(List.of(new ErrorCampo("kilometrajeIngreso", "KILOMETRAJE_MENOR")));
        }
        List<AsignacionMecanico> pedidas = datos.mecanicos() == null ? List.of() : datos.mecanicos();
        if (!pedidas.isEmpty() && !usuarioActual.tienePermiso(Permiso.ORDENES_ASIGNAR.name())) {
            throw new AccessDeniedException("Asignar mecánicos requiere ORDENES_ASIGNAR");
        }
        List<Asignacion> asignaciones = validarMecanicos(pedidas);

        Instant ahora = Instant.now(clock);
        Long usuarioId = usuarioActual.id().orElse(null);
        OrdenTrabajo orden = new OrdenTrabajo(consecutivos.siguiente(TipoConsecutivo.OT), cliente, moto,
                datos.kilometrajeIngreso(), recepcion(datos.motivoIngreso(), datos.descripcionProblema(),
                        datos.observaciones()), usuarioId, ahora);
        CambioMecanicos cambio = orden.asignarMecanicos(asignaciones, ahora);
        repository.save(orden);

        auditoria.registrar("ORDEN_CREADA", ENTIDAD, orden.getId(), Map.of("numero", orden.getNumero(),
                "motocicletaId", moto.getId(), "mecanicos", cambio.agregados()));
        eventos.publishEvent(new OrdenCreada(orden.getId(), orden.getNumero(), cliente.getId(), moto.getId(),
                usuarioId));
        publicarAsignaciones(orden, cambio, usuarioId);
        return orden;
    }

    @Transactional
    public void actualizarRecepcion(Long id, ActualizarRecepcion datos) {
        OrdenTrabajo orden = paraModificar(id, datos.version());
        DatosRecepcion nuevos = recepcion(datos.motivoIngreso(), datos.descripcionProblema(), datos.observaciones());
        List<String> campos = new ArrayList<>();
        agregarSiCambia(campos, "motivoIngreso", orden.getMotivoIngreso(), nuevos.motivoIngreso());
        agregarSiCambia(campos, "descripcionProblema", orden.getDescripcionProblema(), nuevos.descripcionProblema());
        agregarSiCambia(campos, "observaciones", orden.getObservaciones(), nuevos.observaciones());
        orden.actualizarRecepcion(nuevos);
        if (!campos.isEmpty()) {
            auditoria.registrar("ORDEN_ACTUALIZADA", ENTIDAD, id, Map.of("campos", campos));
        }
    }

    /** RN-26: reemplaza los mecánicos mientras la orden esté activa. */
    @Transactional
    public void asignarMecanicos(Long id, AsignarMecanicos datos) {
        OrdenTrabajo orden = paraModificar(id, datos.version());
        List<Asignacion> asignaciones = validarMecanicos(datos.mecanicos());
        CambioMecanicos cambio = orden.asignarMecanicos(asignaciones, Instant.now(clock));
        auditoria.registrar("ORDEN_MECANICOS_ASIGNADOS", ENTIDAD, id, Map.of("agregados", cambio.agregados(),
                "quitados", cambio.quitados()));
        publicarAsignaciones(orden, cambio, usuarioActual.id().orElse(null));
    }

    /** RF14: en diagnóstico o en reparación; el kilometraje de inspección no baja del de ingreso. */
    @Transactional
    public void registrarDiagnostico(Long id, RegistrarDiagnostico datos) {
        OrdenTrabajo orden = paraModificar(id, datos.version());
        Integer kilometraje = datos.kilometrajeInspeccion();
        if (kilometraje != null && kilometraje < orden.getKilometrajeIngreso()) {
            throw BusinessException.validacion(List.of(new ErrorCampo("kilometrajeInspeccion", "KILOMETRAJE_MENOR")));
        }
        boolean primero = !orden.tieneDiagnostico();
        orden.registrarDiagnostico(new DatosDiagnostico(datos.diagnostico().trim(), texto(datos.observaciones()),
                kilometraje));
        auditoria.registrar(primero ? "ORDEN_DIAGNOSTICO_REGISTRADO" : "ORDEN_DIAGNOSTICO_ACTUALIZADO", ENTIDAD, id,
                Map.of("estado", orden.getEstado().name()));
    }

    /**
     * RF13: transición pedida por un usuario. Debe existir en el diagrama y no ser automática
     * (RN-22), el usuario debe tener su permiso, traer nota si la exige y cumplirse su condición.
     * Queda en el historial (RN-23) y publica {@link EstadoOrdenCambiado}.
     */
    @Transactional
    public void transicionar(Long id, SolicitarTransicion datos) {
        OrdenTrabajo orden = paraModificar(id, datos.version());
        EstadoOrden desde = orden.getEstado();
        EstadoOrden hasta = datos.estado();
        EstadoOrden.Regla regla = desde.regla(hasta)
                .orElseThrow(() -> OrdenTrabajo.transicionInvalida(desde, hasta, null));
        if (regla.esAutomatica()) {
            throw OrdenTrabajo.transicionInvalida(desde, hasta, "AUTOMATICA");
        }
        if (!usuarioActual.tienePermiso(regla.permiso().name())) {
            throw new AccessDeniedException("La transición requiere " + regla.permiso());
        }
        String nota = texto(datos.nota());
        if (regla.requiereNota() && nota == null) {
            throw BusinessException.validacion(List.of(new ErrorCampo("nota", "NOTA_REQUERIDA")));
        }
        Optional<String> bloqueo = bloqueo(orden, hasta);
        if (bloqueo.isPresent()) {
            throw OrdenTrabajo.transicionInvalida(desde, hasta, bloqueo.get());
        }
        Long usuarioId = usuarioActual.id().orElse(null);
        orden.transicionarA(hasta, usuarioId, nota, Instant.now(clock));
        auditoria.registrar("ORDEN_TRANSICION", ENTIDAD, id, Map.of("numero", orden.getNumero(),
                "desde", desde.name(), "hasta", hasta.name()));
        eventos.publishEvent(new EstadoOrdenCambiado(id, orden.getNumero(), desde, hasta, usuarioId, nota));
    }

    /**
     * Condición de negocio que aún no se cumple para llegar a {@code destino}, si hay alguna.
     * Los ítems (y el presupuesto que se genera con ellos) llegan en F09B y el pago en F09C: hasta
     * entonces ninguna orden los tiene, así que esas transiciones quedan bloqueadas.
     */
    static Optional<String> bloqueo(OrdenTrabajo orden, EstadoOrden destino) {
        return Optional.ofNullable(switch (destino) {
            case EN_DIAGNOSTICO -> orden.getEstado() == EstadoOrden.RECIBIDA && orden.getMecanicos().isEmpty()
                    ? "SIN_MECANICOS" : null;
            case PENDIENTE_APROBACION -> orden.tieneDiagnostico() ? "SIN_ITEMS" : "SIN_DIAGNOSTICO";
            case ENTREGADA -> "SIN_PAGO";
            default -> null;
        });
    }

    AccionesPermitidas acciones(OrdenTrabajo orden) {
        Set<String> permisos = usuarioActual.permisos();
        EstadoOrden estado = orden.getEstado();
        List<AccionesPermitidas.Transicion> transiciones = new ArrayList<>();
        for (EstadoOrden destino : estado.destinos()) {
            EstadoOrden.Regla regla = estado.regla(destino).orElseThrow();
            if (!regla.esAutomatica() && permisos.contains(regla.permiso().name())) {
                transiciones.add(new AccionesPermitidas.Transicion(destino, regla.requiereNota(),
                        bloqueo(orden, destino).orElse(null)));
            }
        }
        boolean diagnosticable = estado == EstadoOrden.EN_DIAGNOSTICO || estado == EstadoOrden.EN_REPARACION;
        return new AccionesPermitidas(orden.esActiva() && permisos.contains(Permiso.ORDENES_CREAR.name()),
                orden.esActiva() && permisos.contains(Permiso.ORDENES_ASIGNAR.name()),
                diagnosticable && permisos.contains(Permiso.ORDENES_TRABAJAR.name()), List.copyOf(transiciones));
    }

    /** Carga la orden para modificarla: visible para el usuario y en la versión que él leyó. */
    private OrdenTrabajo paraModificar(Long id, long version) {
        OrdenTrabajo orden = repository.paraModificar(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
        exigirVisible(orden);
        if (orden.getVersion() != version) {
            throw new ConflictException(ErrorCode.CONFLICTO_CONCURRENCIA,
                    "Otro usuario modificó la orden. Recargue e intente de nuevo", Map.of("version", orden.getVersion()));
        }
        return orden;
    }

    /** RN-27: 404 (no 403) para no revelar que la orden existe. */
    private void exigirVisible(OrdenTrabajo orden) {
        if (!puedeVerTodas() && !orden.estaAsignado(usuarioActual.idRequerido())) {
            throw new NotFoundException(ENTIDAD, orden.getId());
        }
    }

    private boolean puedeVerTodas() {
        return usuarioActual.tienePermiso(Permiso.ORDENES_VER_TODAS.name());
    }

    /** RN-26: usuarios activos con rol MECANICO, sin repetir; los errores van por posición. */
    private List<Asignacion> validarMecanicos(List<AsignacionMecanico> pedidas) {
        Set<Long> validos = usuarios.mecanicosActivos(pedidas.stream().map(AsignacionMecanico::mecanicoId)
                .collect(Collectors.toSet())).stream().map(Usuario::getId).collect(Collectors.toSet());
        List<ErrorCampo> errores = new ArrayList<>();
        Set<Long> vistos = new HashSet<>();
        for (int i = 0; i < pedidas.size(); i++) {
            String campo = "mecanicos[" + i + "].mecanicoId";
            Long mecanicoId = pedidas.get(i).mecanicoId();
            if (!vistos.add(mecanicoId)) {
                errores.add(new ErrorCampo(campo, "MECANICO_REPETIDO"));
            } else if (!validos.contains(mecanicoId)) {
                errores.add(new ErrorCampo(campo, "MECANICO_INVALIDO"));
            }
        }
        if (!errores.isEmpty()) {
            throw BusinessException.validacion(errores);
        }
        return pedidas.stream().map(a -> new Asignacion(a.mecanicoId(), texto(a.actividad()))).toList();
    }

    private void publicarAsignaciones(OrdenTrabajo orden, CambioMecanicos cambio, Long usuarioId) {
        cambio.agregados().forEach(mecanicoId -> eventos.publishEvent(
                new MecanicoAsignado(orden.getId(), orden.getNumero(), mecanicoId, usuarioId)));
    }

    /** La lectura más alta de kilometraje (de ingreso o de inspección) de la moto; {@code null} si no tiene órdenes. */
    private Integer ultimoKilometraje(Long motocicletaId) {
        Integer ingreso = repository.maximoKilometrajeIngreso(motocicletaId).orElse(null);
        Integer inspeccion = repository.maximoKilometrajeInspeccion(motocicletaId).orElse(null);
        if (ingreso == null || inspeccion == null) {
            return ingreso == null ? inspeccion : ingreso;
        }
        return Math.max(ingreso, inspeccion);
    }

    /** El tablero muestra los mecánicos de cada orden: se cargan por lotes dentro de la transacción. */
    private static Page<OrdenTrabajo> conMecanicos(Page<OrdenTrabajo> pagina) {
        pagina.getContent().forEach(o -> o.getMecanicos().size());
        return pagina;
    }

    /**
     * Carga mecánicos e historial antes de salir de la transacción (open-in-view está apagado).
     * Los getters devuelven vistas inmutables, así que se recorren en vez de usar
     * {@code Hibernate.initialize}, que solo reconoce la colección persistente.
     */
    private static void cargar(OrdenTrabajo orden) {
        orden.getMecanicos().size();
        orden.getHistorial().size();
    }

    private static Specification<OrdenTrabajo> especificacion(FiltroOrdenes f) {
        return OrdenTrabajoSpecifications.filtrar(f.texto(), f.estados(), f.mecanicoId(),
                f.desde() == null ? null : f.desde().atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant(),
                f.hasta() == null ? null : f.hasta().plusDays(1).atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant());
    }

    private static DatosRecepcion recepcion(String motivo, String descripcion, String observaciones) {
        return new DatosRecepcion(motivo.trim(), descripcion.trim(), texto(observaciones));
    }

    private static void agregarSiCambia(List<String> campos, String campo, Object antes, Object despues) {
        if (!Objects.equals(antes, despues)) {
            campos.add(campo);
        }
    }

    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    /** La orden con lo que el usuario actual puede hacer con ella. */
    public record DetalleOrden(OrdenTrabajo orden, AccionesPermitidas acciones) {
    }

    /** Última lectura de kilometraje de la moto y su orden activa (o {@code null}). */
    public record InfoRecepcion(Integer ultimoKilometraje, OrdenActiva ordenActiva) {
    }

    public record OrdenActiva(Long id, String numero, EstadoOrden estado) {
    }
}
