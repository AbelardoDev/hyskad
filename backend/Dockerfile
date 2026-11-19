# syntax=docker/dockerfile:1
# Imagen del backend de HYSKAD (F13). Construir desde backend/: docker build -t hyskad-backend .

# --- 1. Compilación -------------------------------------------------------------------------
FROM eclipse-temurin:25-jdk AS build
WORKDIR /build

# Dependencias en una capa propia: solo se vuelven a descargar si cambia el pom.xml
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q dependency:go-offline

COPY src/ src/
# Las pruebas corren en el CI antes de publicar la imagen
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q package -DskipTests \
    && cp target/hyskad-backend-*.jar app.jar \
    && java -Djarmode=tools -jar app.jar extract --layers --destination extraido

# --- 2. Ejecución ---------------------------------------------------------------------------
FROM eclipse-temurin:25-jre
WORKDIR /app

RUN groupadd --system hyskad && useradd --system --gid hyskad --no-create-home hyskad

# Jar en capas, de la que menos cambia a la que más: las dependencias quedan en caché entre versiones
COPY --from=build /build/extraido/dependencies/ ./
COPY --from=build /build/extraido/spring-boot-loader/ ./
COPY --from=build /build/extraido/snapshot-dependencies/ ./
COPY --from=build /build/extraido/application/ ./

USER hyskad
EXPOSE 8080

# VPS pequeño: el heap se ajusta al límite de memoria del contenedor
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError -Duser.timezone=America/Bogota" \
    SPRING_PROFILES_ACTIVE=prod

# La imagen no trae curl: se consulta /actuator/health con el /dev/tcp de bash
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080 \
        && printf "GET /actuator/health HTTP/1.0\r\nHost: localhost\r\n\r\n" >&3 \
        && grep -q "\"status\":\"UP\"" <&3'

ENTRYPOINT ["java", "-jar", "app.jar"]
