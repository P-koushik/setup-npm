package com.example.app.health;

import java.time.Instant;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class HealthController {

  @GetMapping
  public Map<String, Object> index() {
    return Map.of(
      "service", "springboot-template",
      "message", "API is ready"
    );
  }

  @GetMapping("/health")
  public Map<String, Object> health() {
    return Map.of(
      "status", "ok",
      "service", "springboot-template",
      "timestamp", Instant.now().toString()
    );
  }
}
