package com.hyskad.configuracion.application;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.hyskad.configuracion.domain.Configuracion;
import com.hyskad.configuracion.persistence.ConfiguracionRepository;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCampo;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.validation.DigitoVerificacionNit;
import com.hyskad.shared.validation.Normalizador;

/**
 * Parámetros del sistema con caché en memoria: se cargan todos en la primera lectura y la caché se
 * descarta cuando se actualiza un valor (al confirmar la transacción).
 */
@Service
public class ConfiguracionService {

    static final String IVA_PORCENTAJE = "iva.porcentaje";
    static final String TALLER_NOMBRE = "taller.nombre";
    static final String TALLER_NIT = "taller.nit";
    static final String TALLER_DIRECCION = "taller.direccion";
    static final String TALLER_TELEFONO = "taller.telefono";
    static final String STOCK_ALERTA_HABILITADA = "stock.alerta.habilitada";
    static final String TALLER_EMAIL = "taller.email";
    static final String TEXTO_AUTORIZACION = "privacidad.texto_autorizacion";
    static final String ENTIDAD = "configuracion";

    private final ConfiguracionRepository repository;
    private final AuditoriaService auditoria;
    private volatile Map<String, String> cache;

    public ConfiguracionService(ConfiguracionRepository repository, AuditoriaService auditoria) {
        this.repository = repository;
        this.auditoria = auditoria;
    }

    public ConfiguracionTaller obtener() {
        return new ConfiguracionTaller(valor(TALLER_NOMBRE), valor(TALLER_NIT), valor(TALLER_DIRECCION),
                valor(TALLER_TELEFONO), valor(TALLER_EMAIL), getIvaPorcentaje(), getTextoAutorizacionDatos(),
                isAlertaStockHabilitada());
    }

    /** RN-45: texto que se muestra al registrar un cliente; párrafos separados por una línea en blanco. */
    public String getTextoAutorizacionDatos() {
        return valor(TEXTO_AUTORIZACION);
    }

    /**
     * F11: guarda la configuración del taller. El NIT se valida con su DV (RN-39) y se guarda como
     * {@code 900123456-8}. Se audita qué campos cambiaron y, si cambió, el IVA anterior y el nuevo (RN-51).
     */
    @Transactional
    public ConfiguracionTaller actualizar(ActualizarConfiguracion datos) {
        String nit = nitConDv(datos.nit());
        String email = datos.email() == null || datos.email().isBlank() ? "" : datos.email().trim().toLowerCase(Locale.ROOT);
        BigDecimal iva = datos.ivaPorcentaje().stripTrailingZeros();
        Map<String, String> nuevos = new LinkedHashMap<>();
        nuevos.put(TALLER_NOMBRE, datos.nombre().trim());
        nuevos.put(TALLER_NIT, nit);
        nuevos.put(TALLER_DIRECCION, datos.direccion().trim());
        nuevos.put(TALLER_TELEFONO, Normalizador.telefono(datos.telefono()));
        nuevos.put(TALLER_EMAIL, email);
        nuevos.put(IVA_PORCENTAJE, iva.toPlainString());
        nuevos.put(TEXTO_AUTORIZACION, datos.textoAutorizacionDatos().strip());
        nuevos.put(STOCK_ALERTA_HABILITADA, Boolean.toString(datos.alertaStockHabilitada()));

        BigDecimal ivaAnterior = getIvaPorcentaje();
        List<String> cambiados = new ArrayList<>();
        nuevos.forEach((clave, valor) -> {
            if (!valor.equals(valores().get(clave))) {
                cambiados.add(clave);
                actualizar(clave, valor);
            }
        });
        if (!cambiados.isEmpty()) {
            Map<String, Object> detalle = new LinkedHashMap<>();
            detalle.put("campos", cambiados);
            if (cambiados.contains(IVA_PORCENTAJE)) {
                detalle.put("ivaAnterior", ivaAnterior.toPlainString());
                detalle.put("ivaNuevo", iva.toPlainString());
            }
            auditoria.registrar("CONFIGURACION_ACTUALIZADA", ENTIDAD, null, detalle);
        }
        return new ConfiguracionTaller(nuevos.get(TALLER_NOMBRE), nit, nuevos.get(TALLER_DIRECCION),
                nuevos.get(TALLER_TELEFONO), email, iva, nuevos.get(TEXTO_AUTORIZACION), datos.alertaStockHabilitada());
    }

    /** NIT de 9 dígitos con su DV (RN-39); acepta {@code 900123456-8} o {@code 9001234568}. */
    static String nitConDv(String nit) {
        String digitos = nit.replaceAll("[^0-9]", "");
        if (digitos.length() != 10 || DigitoVerificacionNit.calcular(digitos.substring(0, 9))
                != Character.digit(digitos.charAt(9), 10)) {
            throw BusinessException.validacion(List.of(new ErrorCampo("nit", "NIT_INVALIDO")));
        }
        return digitos.substring(0, 9) + "-" + digitos.charAt(9);
    }

    /** Porcentaje de IVA vigente (RN-03), ej. {@code 19}. */
    public BigDecimal getIvaPorcentaje() {
        return new BigDecimal(valor(IVA_PORCENTAJE));
    }

    public DatosTaller getDatosTaller() {
        return new DatosTaller(valor(TALLER_NOMBRE), valor(TALLER_NIT), valor(TALLER_DIRECCION),
                valor(TALLER_TELEFONO));
    }

    public boolean isAlertaStockHabilitada() {
        return Boolean.parseBoolean(valor(STOCK_ALERTA_HABILITADA));
    }

    public String valor(String clave) {
        String valor = valores().get(clave);
        if (valor == null) {
            throw new NotFoundException("configuracion", clave);
        }
        return valor;
    }

    /** Cambia un parámetro (la caché se descarta al confirmar). */
    @Transactional
    public void actualizar(String clave, String valor) {
        Configuracion configuracion = repository.findByClave(clave)
                .orElseThrow(() -> new NotFoundException("configuracion", clave));
        configuracion.cambiarValor(valor);
        invalidarAlConfirmar();
    }

    private Map<String, String> valores() {
        Map<String, String> actual = cache;
        if (actual == null) {
            actual = repository.findAll().stream()
                    .collect(Collectors.toUnmodifiableMap(Configuracion::getClave, Configuracion::getValor));
            cache = actual;
        }
        return actual;
    }

    private void invalidarAlConfirmar() {
        cache = null;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    cache = null;
                }
            });
        }
    }
}
