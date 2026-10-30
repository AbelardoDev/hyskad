package com.hyskad;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.dependencies.SlicesRuleDefinition.slices;

import java.util.Optional;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.data.repository.Repository;
import org.springframework.web.bind.annotation.RestController;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

import jakarta.persistence.Entity;

/**
 * Reglas de ARCHITECTURE.md §2, escritas por patrón de paquete para que apliquen solas a cada
 * módulo nuevo ({@code com.hyskad.<modulo>.web|application|domain|persistence}).
 */
@AnalyzeClasses(packages = "com.hyskad", importOptions = ImportOption.DoNotIncludeTests.class)
class ArquitecturaTest {

    private static final Pattern MODULO = Pattern.compile("^com\\.hyskad\\.([^.]+)(\\..*)?$");

    @ArchTest
    static final ArchRule applicationNoDependeDeWeb = noClasses()
            .that().resideInAPackage("com.hyskad.*.application..")
            .should().dependOnClassesThat(enCapaDeModulo("web"))
            .because("las capas van web → application → domain");

    @ArchTest
    static final ArchRule domainEsIndependiente = noClasses()
            .that().resideInAPackage("com.hyskad.*.domain..")
            .should().dependOnClassesThat(enCapaDeModulo("web", "application", "persistence"))
            .orShould().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework.web..", "org.springframework.http..", "jakarta.servlet..")
            .because("el dominio no conoce la web, los casos de uso ni la persistencia");

    @ArchTest
    static final ArchRule persistenceNoDependeDeCapasSuperiores = noClasses()
            .that().resideInAPackage("com.hyskad.*.persistence..")
            .should().dependOnClassesThat(enCapaDeModulo("web", "application"))
            .because("persistence → domain");

    @ArchTest
    static final ArchRule persistenceSoloDesdeSuModulo = classes()
            .should(soloUsarPersistenceDeSuPropioModulo())
            .because("un módulo usa el servicio público de otro, nunca su persistencia");

    @ArchTest
    static final ArchRule repositoriosSoloDesdeSuModulo = classes()
            .should(soloUsarRepositoriosDeSuPropioModulo())
            .because("un módulo no usa repositorios de otro módulo");

    @ArchTest
    static final ArchRule controllersNoUsanRepositorios = noClasses()
            .that().areAnnotatedWith(RestController.class)
            .should().dependOnClassesThat().areAssignableTo(Repository.class)
            .because("los controllers solo llaman servicios");

    @ArchTest
    static final ArchRule controllersNoDevuelvenEntidades = methods()
            .that().areDeclaredInClassesThat().areAnnotatedWith(RestController.class)
            .and().arePublic()
            .should().notHaveRawReturnType(anotadaConEntity())
            .because("la API devuelve DTOs, nunca entidades JPA");

    @ArchTest
    static final ArchRule sinCiclosEntreModulos = slices()
            .matching("com.hyskad.(*)..")
            .should().beFreeOfCycles()
            .ignoreDependency(DescribedPredicate.alwaysTrue(), JavaClass.Predicates.resideInAPackage("com.hyskad.shared.."))
            .ignoreDependency(JavaClass.Predicates.resideInAPackage("com.hyskad.shared.."), DescribedPredicate.alwaysTrue());

    /**
     * Clases en una capa de un módulo de negocio. {@code shared} queda fuera: es transversal
     * (BaseEntity, PageResponse...) y todos los módulos pueden usarlo.
     */
    private static DescribedPredicate<JavaClass> enCapaDeModulo(String... capas) {
        Pattern patron = Pattern.compile(
                "^com\\.hyskad\\.(?!shared\\.)[^.]+\\.(" + String.join("|", capas) + ")(\\..*)?$");
        return DescribedPredicate.describe("en la capa " + String.join("/", capas) + " de un módulo",
                clase -> patron.matcher(clase.getPackageName()).matches());
    }

    private static DescribedPredicate<JavaClass> anotadaConEntity() {
        return DescribedPredicate.describe("una entidad JPA", clase -> clase.isAnnotatedWith(Entity.class));
    }

    private static ArchCondition<JavaClass> soloUsarPersistenceDeSuPropioModulo() {
        return dependenciasProhibidas("usar solo el paquete persistence de su propio módulo",
                enCapaDeModulo("persistence"));
    }

    private static ArchCondition<JavaClass> soloUsarRepositoriosDeSuPropioModulo() {
        return dependenciasProhibidas("usar solo repositorios de su propio módulo",
                destino -> destino.isAssignableTo(Repository.class) && !destino.isEquivalentTo(Repository.class)
                        && destino.getPackageName().startsWith("com.hyskad."));
    }

    /** Falla si una clase depende de un destino que cumple el filtro y pertenece a otro módulo. */
    private static ArchCondition<JavaClass> dependenciasProhibidas(String descripcion,
            Predicate<? super JavaClass> esDestinoRestringido) {
        return new ArchCondition<>(descripcion) {
            @Override
            public void check(JavaClass origen, ConditionEvents events) {
                Optional<String> moduloOrigen = modulo(origen);
                for (Dependency dependencia : origen.getDirectDependenciesFromSelf()) {
                    JavaClass destino = dependencia.getTargetClass();
                    if (!esDestinoRestringido.test(destino)) {
                        continue;
                    }
                    Optional<String> moduloDestino = modulo(destino);
                    if (!moduloDestino.equals(moduloOrigen)) {
                        events.add(SimpleConditionEvent.violated(dependencia, dependencia.getDescription()));
                    }
                }
            }
        };
    }

    private static Optional<String> modulo(JavaClass clase) {
        Matcher m = MODULO.matcher(clase.getPackageName());
        return m.matches() ? Optional.of(m.group(1)) : Optional.empty();
    }
}
