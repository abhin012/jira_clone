package com.example.jira.security;

import com.example.jira.model.Project;
import com.example.jira.repository.Projectrepository;
import org.bson.types.ObjectId;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
public class AccessControlService {

    private final Projectrepository projectrepository;

    public AccessControlService(Projectrepository projectrepository) {
        this.projectrepository = projectrepository;
    }

    public String currentUserId(Authentication authentication) {
        if (authentication == null) {
            throw new RuntimeException("Access denied: not authenticated");
        }
        return authentication.getName();
    }

    public Project requireProjectAccess(String projectId, Authentication authentication) {
        String userId = currentUserId(authentication);

        Project project;
        try {
            project = projectrepository.findById(new ObjectId(projectId))
                    .orElseThrow(() -> new RuntimeException("Project not found"));
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Project not found");
        }

        boolean isOwner = userId.equals(project.getOwnerId());
        boolean isMember = project.getMemberIds() != null && project.getMemberIds().contains(userId);

        if (!isOwner && !isMember) {
            throw new RuntimeException("Access denied: not a member of this project");
        }

        return project;
    }

    public Project requireProjectOwner(String projectId, Authentication authentication) {
        Project project = requireProjectAccess(projectId, authentication);
        String userId = currentUserId(authentication);
        if (!userId.equals(project.getOwnerId())) {
            throw new RuntimeException("Access denied: only the project owner can do this");
        }
        return project;
    }
}