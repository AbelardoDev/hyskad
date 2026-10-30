package com.hyskad.shared.error;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.core.PropertyReferenceException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.hyskad.shared.web.RequestIdFilter;

import jakarta.persistence.OptimisticLockException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import tools.jackson.databind.DatabindException;
import tools.jackson.databind.exc.UnrecognizedPropertyException;

/**
 * Traduce toda excepción a un {@link ProblemDetail} (RFC 9457) con la propiedad {@code code}
 * estable y, en validación, {@code errors: [{campo, code}]}. Nunca filtra detalles internos.
 * Los 4xx se registran en WARN sin stacktrace y los 5xx en ERROR con stacktrace.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    /** {@code type} del ProblemDetail: URN estable por código (no resoluble, permitido por RFC 9457). */
    static final String TIPO_PREFIJO = "urn:hyskad:error:";
    private static final Pattern CODIGO = Pattern.compile("^[A-Z][A-Z0-9_]+$");

    @ExceptionHandler(BusinessException.class)
    ResponseEntity<ProblemDetail> negocio(BusinessException ex, HttpServletRequest request) {
        ProblemDetail problema = problema(ex.getCode(), ex.getMessage(), request);
        ex.getParametros().forEach(problema::setProperty);
        return responder(problema, ex);
    }

    @ExceptionHandler(DemasiadasSolicitudesException.class)
    ResponseEntity<ProblemDetail> demasiadasSolicitudes(DemasiadasSolicitudesException ex,
            HttpServletRequest request) {
        ProblemDetail problema = problema(ex.getCode(), ex.getMessage(), request);
        registrar(problema, ex);
        return ResponseEntity.status(problema.getStatus())
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getSegundosParaReintentar()))
                .body(problema);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> cuerpoInvalido(MethodArgumentNotValidException ex,
            HttpServletRequest request) {
        List<ErrorCampo> errores = new ArrayList<>();
        ex.getBindingResult().getFieldErrors().forEach(error -> errores.add(errorDeCampo(error)));
        ex.getBindingResult().getGlobalErrors().forEach(error -> errores.add(
                new ErrorCampo(error.getObjectName(), codigoDe(error.getDefaultMessage(), error.getCode()))));
        return validacion(errores, request, ex);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ProblemDetail> parametrosInvalidos(HandlerMethodValidationException ex,
            HttpServletRequest request) {
        List<ErrorCampo> errores = new ArrayList<>();
        ex.getParameterValidationResults().forEach(resultado -> {
            String campo = resultado.getMethodParameter().getParameterName();
            for (MessageSourceResolvable error : resultado.getResolvableErrors()) {
                String[] codigos = error.getCodes();
                String constraint = codigos == null || codigos.length == 0 ? null : codigos[codigos.length - 1];
                errores.add(new ErrorCampo(campo, codigoDe(error.getDefaultMessage(), constraint)));
            }
        });
        return validacion(errores, request, ex);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ProblemDetail> restriccionesVioladas(ConstraintViolationException ex,
            HttpServletRequest request) {
        List<ErrorCampo> errores = ex.getConstraintViolations().stream()
                .map(v -> new ErrorCampo(ultimoNodo(v.getPropertyPath().toString()), codigoDe(v.getMessage(),
                        v.getConstraintDescriptor().getAnnotation().annotationType().getSimpleName())))
                .toList();
        return validacion(errores, request, ex);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ProblemDetail> cuerpoIlegible(HttpMessageNotReadableException ex,
            HttpServletRequest request) {
        ProblemDetail problema = problema(ErrorCode.SOLICITUD_MALFORMADA,
                "El cuerpo de la solicitud no es un JSON válido para este recurso", request);
        if (ex.getCause() instanceof UnrecognizedPropertyException desconocida) {
            problema.setProperty("errors",
                    List.of(new ErrorCampo(desconocida.getPropertyName(), "PROPIEDAD_DESCONOCIDA")));
        } else if (ex.getCause() instanceof DatabindException mapeo && !mapeo.getPath().isEmpty()) {
            problema.setProperty("errors", List.of(new ErrorCampo(rutaJson(mapeo), "TIPO_INVALIDO")));
        }
        return responder(problema, ex);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ProblemDetail> tipoDeParametro(MethodArgumentTypeMismatchException ex,
            HttpServletRequest request) {
        ProblemDetail problema = problema(ErrorCode.PARAMETRO_INVALIDO,
                "El parámetro '" + ex.getName() + "' tiene un formato inválido", request);
        problema.setProperty("errors", List.of(new ErrorCampo(ex.getName(), "TIPO_INVALIDO")));
        return responder(problema, ex);
    }

    /** Ordenamiento por una propiedad inexistente ({@code ?sort=noExiste}). */
    @ExceptionHandler(PropertyReferenceException.class)
    ResponseEntity<ProblemDetail> propiedadDeOrden(PropertyReferenceException ex, HttpServletRequest request) {
        ProblemDetail problema = problema(ErrorCode.PARAMETRO_INVALIDO,
                "No se puede ordenar por '" + ex.getPropertyName() + "'", request);
        problema.setProperty("errors", List.of(new ErrorCampo("sort", "TIPO_INVALIDO")));
        return responder(problema, ex);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ProblemDetail> parametroFaltante(MissingServletRequestParameterException ex,
            HttpServletRequest request) {
        ProblemDetail problema = problema(ErrorCode.PARAMETRO_REQUERIDO,
                "Falta el parámetro '" + ex.getParameterName() + "'", request);
        problema.setProperty("errors", List.of(new ErrorCampo(ex.getParameterName(), "REQUERIDO")));
        return responder(problema, ex);
    }

    @ExceptionHandler({ NoResourceFoundException.class, NoHandlerFoundException.class })
    ResponseEntity<ProblemDetail> rutaInexistente(Exception ex, HttpServletRequest request) {
        return responder(problema(ErrorCode.RUTA_NO_ENCONTRADA, "La ruta solicitada no existe", request), ex);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ProblemDetail> metodoNoPermitido(HttpRequestMethodNotSupportedException ex,
            HttpServletRequest request) {
        ProblemDetail problema = problema(ErrorCode.METODO_NO_PERMITIDO,
                "El método " + ex.getMethod() + " no está permitido en esta ruta", request);
        ResponseEntity.BodyBuilder respuesta = ResponseEntity.status(problema.getStatus());
        if (ex.getSupportedHttpMethods() != null) {
            respuesta.allow(ex.getSupportedHttpMethods().toArray(HttpMethod[]::new));
        }
        registrar(problema, ex);
        return respuesta.body(problema);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ProblemDetail> tipoContenido(HttpMediaTypeNotSupportedException ex,
            HttpServletRequest request) {
        return responder(problema(ErrorCode.TIPO_CONTENIDO_NO_SOPORTADO,
                "Tipo de contenido no soportado", request), ex);
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ProblemDetail> noAutenticado(AuthenticationException ex, HttpServletRequest request) {
        return responder(problema(ErrorCode.NO_AUTENTICADO, "Se requiere autenticación", request), ex);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ProblemDetail> accesoDenegado(AccessDeniedException ex, HttpServletRequest request) {
        return responder(problema(ErrorCode.ACCESO_DENEGADO,
                "No tiene permiso para realizar esta operación", request), ex);
    }

    @ExceptionHandler({ OptimisticLockingFailureException.class, OptimisticLockException.class })
    ResponseEntity<ProblemDetail> concurrencia(Exception ex, HttpServletRequest request) {
        return responder(problema(ErrorCode.CONFLICTO_CONCURRENCIA,
                "Otro usuario modificó este registro. Recargue e intente de nuevo", request), ex);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> integridad(DataIntegrityViolationException ex, HttpServletRequest request) {
        return responder(problema(ErrorCode.CONFLICTO_DATOS,
                "La operación entra en conflicto con datos existentes", request), ex);
    }

    /**
     * Cualquier otra excepción. Las de Spring MVC que ya traen su status (406, 413...) lo conservan;
     * el resto es un 500 sin detalles internos.
     */
    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> inesperado(Exception ex, HttpServletRequest request) {
        if (ex instanceof ErrorResponse errorSpring && !errorSpring.getStatusCode().is5xxServerError()) {
            HttpStatusCode status = errorSpring.getStatusCode();
            ProblemDetail problema = problema(ErrorCode.SOLICITUD_MALFORMADA, "No se pudo procesar la solicitud",
                    request);
            problema.setStatus(status.value());
            problema.setTitle(null);
            return responder(problema, ex);
        }
        return responder(problema(ErrorCode.ERROR_INTERNO, "Ocurrió un error inesperado", request), ex);
    }

    private ResponseEntity<ProblemDetail> validacion(List<ErrorCampo> errores, HttpServletRequest request,
            Exception ex) {
        ProblemDetail problema = problema(ErrorCode.VALIDACION, "La solicitud tiene datos inválidos", request);
        problema.setProperty("errors", errores);
        return responder(problema, ex);
    }

    private static ProblemDetail problema(ErrorCode code, String detalle, HttpServletRequest request) {
        ProblemDetail problema = ProblemDetail.forStatusAndDetail(code.status(), detalle);
        problema.setType(URI.create(TIPO_PREFIJO + code.name()));
        problema.setTitle(code.status().getReasonPhrase());
        problema.setInstance(URI.create(request.getRequestURI()));
        problema.setProperty("code", code.name());
        String requestId = MDC.get(RequestIdFilter.MDC_CLAVE);
        if (requestId != null) {
            problema.setProperty("requestId", requestId);
        }
        return problema;
    }

    private static ResponseEntity<ProblemDetail> responder(ProblemDetail problema, Exception ex) {
        registrar(problema, ex);
        return ResponseEntity.status(problema.getStatus()).body(problema);
    }

    private static void registrar(ProblemDetail problema, Exception ex) {
        Map<String, Object> props = problema.getProperties();
        Object code = props == null ? null : props.get("code");
        if (problema.getStatus() >= 500) {
            log.error("Error {} en {}", code, problema.getInstance(), ex);
        } else {
            log.warn("Error {} en {}: {}", code, problema.getInstance(), ex.getClass().getSimpleName());
        }
    }

    private static ErrorCampo errorDeCampo(FieldError error) {
        return new ErrorCampo(error.getField(), codigoDe(error.getDefaultMessage(), error.getCode()));
    }

    /**
     * Si el mensaje de la restricción ya es un código (ej. {@code PLACA_INVALIDA}) se usa tal cual;
     * si no, se deriva del nombre de la restricción: {@code NotBlank} → {@code NOT_BLANK}.
     */
    static String codigoDe(String mensaje, String constraint) {
        if (mensaje != null && CODIGO.matcher(mensaje).matches()) {
            return mensaje;
        }
        if (constraint == null || constraint.isBlank()) {
            return "INVALIDO";
        }
        return constraint.replaceAll("([a-z0-9])([A-Z])", "$1_$2").toUpperCase();
    }

    private static String ultimoNodo(String ruta) {
        int punto = ruta.lastIndexOf('.');
        return punto < 0 ? ruta : ruta.substring(punto + 1);
    }

    private static String rutaJson(DatabindException ex) {
        StringBuilder ruta = new StringBuilder();
        ex.getPath().forEach(ref -> {
            if (ref.getPropertyName() != null) {
                ruta.append(ruta.isEmpty() ? "" : ".").append(ref.getPropertyName());
            } else if (ref.getIndex() >= 0) {
                ruta.append('[').append(ref.getIndex()).append(']');
            }
        });
        return ruta.toString();
    }
}
