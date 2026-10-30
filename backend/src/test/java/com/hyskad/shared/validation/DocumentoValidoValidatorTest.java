package com.hyskad.shared.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;

/** CP-15 (parte unitaria): documentos de RN-38 y DV del NIT de RN-39. */
class DocumentoValidoValidatorTest {

    @DocumentoValido
    record Documento(TipoDocumento tipoDocumento, String numeroDocumento) implements ConDocumento {
    }

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void crearValidador() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void cerrar() {
        factory.close();
    }

    @ParameterizedTest(name = "{0} {1}")
    @CsvSource({
        // NIT reales con DV correcto, en distintos formatos de entrada
        "NIT, 899999068-1", // Ecopetrol
        "NIT, 890903938-8", // Bancolombia
        "NIT, 800.197.268-4", // DIAN
        "NIT, 8910800313", // Universidad de Córdoba
        "NIT, 900123456-8",
        "CC, 12345", "CC, 1234567890", "CC, 1.065.432.100",
        "TI, 1234567890", "TI, 12345678901",
        "CE, 123", "CE, e1234567", "CE, AB1234567890",
        "PA, AB12345", "PA, 123456789012345",
        "PPT, 123456", "PPT, 1234567890" })
    void aceptaDocumentosValidos(TipoDocumento tipo, String numero) {
        assertThat(validator.validate(new Documento(tipo, numero))).isEmpty();
    }

    @ParameterizedTest(name = "{0} {1}")
    @CsvSource({
        "NIT, 899999068-2", "NIT, 890903938-0", "NIT, 800197268-5", "NIT, 900123456", "NIT, 90012345-6",
        "NIT, 9001234568-1", "NIT, ABC123456-7" })
    void rechazaNitInvalidoConCodigoPropio(TipoDocumento tipo, String numero) {
        Set<ConstraintViolation<Documento>> errores = validator.validate(new Documento(tipo, numero));

        assertThat(errores).singleElement().satisfies(error -> {
            assertThat(error.getMessage()).isEqualTo("NIT_INVALIDO");
            assertThat(error.getPropertyPath()).hasToString("numeroDocumento");
        });
    }

    @ParameterizedTest(name = "{0} {1}")
    @CsvSource({
        "CC, 1234", "CC, 12345678901", "CC, 12345A",
        "TI, 123456789", "TI, 123456789012",
        "CE, 12", "CE, 1234567890123", "CE, AB#123",
        "PA, 1234", "PA, 1234567890123456",
        "PPT, 12345", "PPT, 12345678901", "PPT, ABC123" })
    void rechazaDocumentosConFormatoInvalido(TipoDocumento tipo, String numero) {
        Set<ConstraintViolation<Documento>> errores = validator.validate(new Documento(tipo, numero));

        assertThat(errores).singleElement().extracting(ConstraintViolation::getMessage)
                .isEqualTo("DOCUMENTO_INVALIDO");
    }

    @Test
    void sinTipoONumeroNoValidaParaCombinarConNotNull() {
        assertThat(validator.validate(new Documento(null, "123"))).isEmpty();
        assertThat(validator.validate(new Documento(TipoDocumento.CC, null))).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({ "899999068, 1", "890903938, 8", "800197268, 4", "891080031, 3", "900123456, 8" })
    void calculaElDigitoDeVerificacion(String nit, int dv) {
        assertThat(DigitoVerificacionNit.calcular(nit)).isEqualTo(dv);
    }

    @Test
    void guardaElNitConGuion() {
        assertThat(Normalizador.documentoParaGuardar(TipoDocumento.NIT, "900.123.456 8")).isEqualTo("900123456-8");
        assertThat(Normalizador.documentoParaGuardar(TipoDocumento.CC, "1.065.432.100")).isEqualTo("1065432100");
    }
}
