FROM openjdk:11.0.16
# RUN addgroup -S acp && adduser -S acp -G acp
# USER acp:acp
ARG JAR_FILE=target/acp-core-ui.jar
COPY ${JAR_FILE} acp-core-ui.jar
EXPOSE 80
ENTRYPOINT ["java","-jar","/acp-core-ui.jar"]
