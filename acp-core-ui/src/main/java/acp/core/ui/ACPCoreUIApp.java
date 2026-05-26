package acp.core.ui;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * ACP Core UI Launcher
 * 
 */
@SpringBootApplication(scanBasePackages = "acp.core.*")
public class ACPCoreUIApp {
    public static void main(String[] args) {
        SpringApplication.run(ACPCoreUIApp.class, args);
    }
}
