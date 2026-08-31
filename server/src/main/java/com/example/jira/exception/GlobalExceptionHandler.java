package com.example.jira.exception;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException ex) {
        HttpStatus status = resolveStatus(ex.getMessage());

        Map<String, String> body = new HashMap<>();
        body.put("message", ex.getMessage());

        return ResponseEntity.status(status).body(body);
    }

    // Best-effort mapping of known messages to sensible HTTP status codes.
    // Keeps existing controller code (which just throws RuntimeException) working
    // without having to touch every controller right now.
    private HttpStatus resolveStatus(String message) {
        if (message == null) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }
        String lower = message.toLowerCase();
        if (lower.contains("not authenticated")) {
            return HttpStatus.UNAUTHORIZED;
        }
        if (lower.contains("access denied") || lower.contains("not a member")) {
            return HttpStatus.FORBIDDEN;
        }
        if (lower.contains("not found")) {
            return HttpStatus.NOT_FOUND;
        }
        if (lower.contains("invalid credentials") || lower.contains("unauthorized")) {
            return HttpStatus.UNAUTHORIZED;
        }
        if (lower.contains("conflict")) {
            return HttpStatus.CONFLICT;
        }
        if (lower.contains("already exists") || lower.contains("invalid")
                || lower.contains("blocked") || lower.contains("circular")) {
            return HttpStatus.BAD_REQUEST;
        }
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
}