package com.example.jira.controller;

import com.example.jira.security.AccessControlService;
import com.example.jira.websocket.PresenceService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/projects")
public class PresenceController {

    private final PresenceService presenceService;
    private final AccessControlService accessControlService;

    public PresenceController(PresenceService presenceService, AccessControlService accessControlService) {
        this.presenceService = presenceService;
        this.accessControlService = accessControlService;
    }

    @GetMapping("/{projectId}/presence")
    public Set<String> getPresence(@PathVariable String projectId, Authentication authentication) {
        accessControlService.requireProjectAccess(projectId, authentication);
        return presenceService.getActiveUsers(projectId);
    }
}