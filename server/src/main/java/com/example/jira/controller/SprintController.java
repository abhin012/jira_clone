package com.example.jira.controller;

import com.example.jira.model.Issue;
import com.example.jira.model.Notification;
import com.example.jira.model.Project;
import com.example.jira.model.Sprint;
import com.example.jira.repository.IssueRepository;
import com.example.jira.repository.Projectrepository;
import com.example.jira.repository.SprintRepository;
import com.example.jira.security.AccessControlService;
import com.example.jira.websocket.NotificationPublisher;
import org.bson.types.ObjectId;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/sprints")
public class SprintController {

    private final SprintRepository sprintRepository;
    private final IssueRepository issueRepository;
    private final Projectrepository projectrepository;
    private final AccessControlService accessControlService;
    private final NotificationPublisher notificationPublisher;

    public SprintController(
            SprintRepository sprintRepository,
            IssueRepository issueRepository,
            Projectrepository projectrepository,
            AccessControlService accessControlService,
            NotificationPublisher notificationPublisher) {
        this.sprintRepository = sprintRepository;
        this.issueRepository = issueRepository;
        this.projectrepository = projectrepository;
        this.accessControlService = accessControlService;
        this.notificationPublisher = notificationPublisher;
    }

    private Set<String> sprintParticipants(String sprintId, String projectId) {
        Set<String> participants = new HashSet<>();
        for (Issue issue : issueRepository.findBySprintId(sprintId)) {
            if (issue.getAssigneeId() != null) participants.add(issue.getAssigneeId());
            else if (issue.getReporterId() != null) participants.add(issue.getReporterId());
        }
        projectrepository.findById(new ObjectId(projectId)).ifPresent(p -> {
            if (p.getOwnerId() != null) participants.add(p.getOwnerId());
        });
        return participants;
    }

    private void notifySprintEvent(Sprint sprint, String type, String message, String actorUserId) {
        for (String recipientId : sprintParticipants(sprint.getId(), sprint.getProjectId())) {
            if (recipientId.equals(actorUserId)) continue;
            Notification notification = new Notification();
            notification.setUserId(recipientId);
            notification.setType(type);
            notification.setMessage(message);
            notificationPublisher.publish(notification);
        }
    }

    @PostMapping
    public Sprint createSprint(@RequestBody Sprint sprint, Authentication authentication) {
        accessControlService.requireProjectAccess(sprint.getProjectId(), authentication);
        sprint.setStatus("PLANNED");
        return sprintRepository.save(sprint);
    }

    @GetMapping("/project/{projectId}")
    public List<Sprint> getSprintsByProject(@PathVariable String projectId, Authentication authentication) {
        accessControlService.requireProjectAccess(projectId, authentication);
        return sprintRepository.findByProjectId(projectId);
    }

    @PutMapping("/{id}/start")
    public Sprint startSprint(@PathVariable String id, Authentication authentication) {

        Sprint sprint = sprintRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        accessControlService.requireProjectAccess(sprint.getProjectId(), authentication);

        boolean alreadyHasActiveSprint = sprintRepository.findByProjectId(sprint.getProjectId()).stream()
                .anyMatch(s -> "ACTIVE".equals(s.getStatus()) && !s.getId().equals(sprint.getId()));

        if (alreadyHasActiveSprint) {
            throw new RuntimeException("Invalid: a sprint is already active for this project. Complete it before starting another.");
        }

        sprint.setStatus("ACTIVE");
        sprint.setStartDate(Instant.now());

        Sprint saved = sprintRepository.save(sprint);
        notifySprintEvent(saved, "SPRINT_STARTED", "Sprint \"" + saved.getName() + "\" has started.",
                accessControlService.currentUserId(authentication));

        return saved;
    }

    @PutMapping("/{id}/complete")
    public Sprint completeSprint(@PathVariable String id, Authentication authentication) {

        Sprint sprint = sprintRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        accessControlService.requireProjectAccess(sprint.getProjectId(), authentication);

        sprint.setStatus("COMPLETED");
        sprint.setEndDate(Instant.now());

        Set<String> participantsBeforeMove = sprintParticipants(id, sprint.getProjectId());

        Sprint saved = sprintRepository.save(sprint);

        String actorUserId = accessControlService.currentUserId(authentication);
        for (String recipientId : participantsBeforeMove) {
            if (recipientId.equals(actorUserId)) continue;
            Notification notification = new Notification();
            notification.setUserId(recipientId);
            notification.setType("SPRINT_ENDED");
            notification.setMessage("Sprint \"" + saved.getName() + "\" has ended.");
            notificationPublisher.publish(notification);
        }

        List<Issue> sprintIssues = issueRepository.findBySprintId(id);
        for (Issue issue : sprintIssues) {
            if (!"DONE".equals(issue.getStatus())) {
                issue.setSprintId(null);
                issue.setUpdatedAt(Instant.now());
                issueRepository.save(issue);
            }
        }

        return saved;
    }

    @PutMapping("/{id}")
    public Sprint updateSprint(
            @PathVariable String id,
            @RequestBody Sprint updated,
            Authentication authentication) {

        Sprint sprint = sprintRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        accessControlService.requireProjectAccess(sprint.getProjectId(), authentication);

        sprint.setName(updated.getName());
        sprint.setGoal(updated.getGoal());
        sprint.setStartDate(updated.getStartDate());
        sprint.setEndDate(updated.getEndDate());

        return sprintRepository.save(sprint);
    }

    @DeleteMapping("/{id}")
    public void deleteSprint(@PathVariable String id, Authentication authentication) {

        Sprint sprint = sprintRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        accessControlService.requireProjectAccess(sprint.getProjectId(), authentication);

        List<Issue> sprintIssues = issueRepository.findBySprintId(id);
        for (Issue issue : sprintIssues) {
            if (!"DONE".equals(issue.getStatus())) {
                issue.setSprintId(null);
                issue.setUpdatedAt(Instant.now());
                issueRepository.save(issue);
            }
        }

        sprintRepository.deleteById(new ObjectId(id));
    }

    @PutMapping("/{sprintId}/issues/{issueId}")
    public Issue addIssueToSprint(
            @PathVariable String sprintId,
            @PathVariable String issueId,
            Authentication authentication) {

        Sprint sprint = sprintRepository.findById(new ObjectId(sprintId))
                .orElseThrow(() -> new RuntimeException("Sprint not found"));

        accessControlService.requireProjectAccess(sprint.getProjectId(), authentication);

        Issue issue = issueRepository.findById(new ObjectId(issueId))
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        issue.setUpdatedAt(Instant.now());
        issue.setSprintId(sprintId);

        return issueRepository.save(issue);
    }
}