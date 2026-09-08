package com.example.jira.controller;

import com.example.jira.model.AuditLog;
import com.example.jira.repository.AuditLogRepository;
import com.example.jira.security.AccessControlService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/audit-logs")
public class AuditLogController {

    private final AuditLogRepository auditLogRepository;
    private final AccessControlService accessControlService;

    public AuditLogController(
            AuditLogRepository auditLogRepository,
            AccessControlService accessControlService) {
        this.auditLogRepository = auditLogRepository;
        this.accessControlService = accessControlService;
    }

    @GetMapping("/entity/{entityType}/{entityId}")
    public List<AuditLog> getEntityAudit(
            @PathVariable String entityType,
            @PathVariable String entityId,
            Authentication authentication) {

        List<AuditLog> entries = auditLogRepository
                .findByEntityTypeAndEntityIdOrderByTimestampDesc(entityType, entityId);

        if (!entries.isEmpty()) {
            accessControlService.requireProjectAccess(entries.get(0).getProjectId(), authentication);
        }
        return entries;
    }

    @GetMapping("/project/{projectId}")
    public List<AuditLog> getProjectAudit(@PathVariable String projectId, Authentication authentication) {
        accessControlService.requireProjectAccess(projectId, authentication);
        return auditLogRepository.findByProjectIdOrderByTimestampDesc(projectId);
    }
}