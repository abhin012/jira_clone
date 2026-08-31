package com.example.jira.controller;

import java.util.List;

import org.bson.types.ObjectId;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.jira.dto.ProjectResponse;
import com.example.jira.model.Project;
import com.example.jira.model.User;
import com.example.jira.repository.Projectrepository;
import com.example.jira.repository.UserRepository;
import com.example.jira.security.AccessControlService;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/projects")
public class Projectcontroller {

    private final Projectrepository projectrepository;
    private final UserRepository userRepository;
    private final AccessControlService accessControlService;

    public Projectcontroller(
            Projectrepository projectrepository,
            UserRepository userRepository,
            AccessControlService accessControlService) {
        this.projectrepository = projectrepository;
        this.userRepository = userRepository;
        this.accessControlService = accessControlService;
    }

    @PostMapping
    public Project createProject(@RequestBody Project project, Authentication authentication) {
        String userId = accessControlService.currentUserId(authentication);
        project.setOwnerId(userId);

        if (project.getMemberIds() == null) {
            project.setMemberIds(new java.util.ArrayList<>());
        }
        if (!project.getMemberIds().contains(userId)) {
            project.getMemberIds().add(userId);
        }
        return projectrepository.save(project);
    }

    @GetMapping
    public List<Project> getAllProjects(Authentication authentication) {
        String userId = accessControlService.currentUserId(authentication);
        return projectrepository.findAll().stream()
                .filter(p -> userId.equals(p.getOwnerId())
                        || (p.getMemberIds() != null && p.getMemberIds().contains(userId)))
                .toList();
    }

    @GetMapping("/{id}")
    public ProjectResponse getProjectById(@PathVariable String id, Authentication authentication) {
        Project project = accessControlService.requireProjectAccess(id, authentication);

        // Fetch owner
        User owner = project.getOwnerId() != null
                ? userRepository.findById(new ObjectId(project.getOwnerId())).orElse(null)
                : null;

        // Fetch members (null-safe)
        List<String> memberIds = project.getMemberIds() != null ? project.getMemberIds() : new java.util.ArrayList<>();
        List<ObjectId> memberObjectIds = memberIds.stream()
                .map(ObjectId::new)
                .toList();

        List<User> members = userRepository.findByIdIn(memberObjectIds);

        return new ProjectResponse(
                project.getId(),
                project.getName(),
                project.getDescription(),
                owner,
                members);
    }

    @PutMapping("/{id}")
    public Project updaProject(@PathVariable String id, @RequestBody Project updated, Authentication authentication) {
        Project project = accessControlService.requireProjectAccess(id, authentication);

        project.setName(updated.getName());
        project.setDescription(updated.getDescription());
        project.setMemberIds(updated.getMemberIds());
        return projectrepository.save(project);
    }

    @DeleteMapping("/{id}")
    public void deleteproject(@PathVariable String id, Authentication authentication) {
        accessControlService.requireProjectOwner(id, authentication);
        projectrepository.deleteById(new ObjectId(id));
    }
}