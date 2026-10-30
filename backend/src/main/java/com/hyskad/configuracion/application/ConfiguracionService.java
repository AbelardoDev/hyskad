package com.hyskad.configuracion.application;

import java.math.BigDecimal;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.hyskad.configuracion.domain.Configuracion;
import com.hyskad.configuracion.persistence.ConfiguracionRepository;
import com.hyskad.shared.error.NotFoundException;

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

    private final ConfiguracionRepository repository;
    private volatile Map<String, String> cache;

    public ConfiguracionService(ConfiguracionRepository repository) {
        this.repository = repository;
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
