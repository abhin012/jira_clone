package com.example.jira.controller;

import com.example.jira.model.AuditLog;
import com.example.jira.model.Issue;
import com.example.jira.model.Project;
import com.example.jira.model.WorkLog;
import com.example.jira.repository.AuditLogRepository;
import com.example.jira.repository.IssueRepository;
import com.example.jira.repository.Projectrepository;
import com.example.jira.repository.SprintRepository;
import com.example.jira.repository.WorkLogRepository;
import com.example.jira.security.AccessControlService;
import org.bson.types.ObjectId;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/worklogs")
public class WorkLogController {

    private final WorkLogRepository workLogRepository;
    private final IssueRepository issueRepository;
    private final Projectrepository projectrepository;
    private final SprintRepository sprintRepository;
    private final AuditLogRepository auditLogRepository;
    private final AccessControlService accessControlService;

    public WorkLogController(
            WorkLogRepository workLogRepository,
            IssueRepository issueRepository,
            Projectrepository projectrepository,
            SprintRepository sprintRepository,
            AuditLogRepository auditLogRepository,
            AccessControlService accessControlService) {
        this.workLogRepository = workLogRepository;
        this.issueRepository = issueRepository;
        this.projectrepository = projectrepository;
        this.sprintRepository = sprintRepository;
        this.auditLogRepository = auditLogRepository;
        this.accessControlService = accessControlService;
    }

    @PostMapping
    public WorkLog createWorkLog(@RequestBody Map<String, Object> body, Authentication authentication) {
        String issueId = (String) body.get("issueId");
        Issue issue = issueRepository.findById(new ObjectId(issueId))
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        String userId = accessControlService.currentUserId(authentication);
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        requireModifyRights(issue, userId);

        LocalDate date = LocalDate.parse((String) body.get("date"));
        double hours = ((Number) body.get("hours")).doubleValue();
        String description = (String) body.get("description");

        validateWorkLog(date, hours, description);

        WorkLog log = new WorkLog();
        log.setIssueId(issueId);
        log.setProjectId(issue.getProjectId());
        log.setUserId(userId);
        log.setDate(date);
        log.setHours(hours);
        log.setDescription(description);

        WorkLog saved = workLogRepository.save(log);

        String details = String.format("Logged %sh on %s — \"%s\"", hours, date, description);
        recordAudit("CREATE", saved, issue, userId, details);

        return saved;
    }

    @GetMapping("/issue/{issueId}")
    public List<WorkLog> getLogsForIssue(@PathVariable String issueId, Authentication authentication) {
        Issue issue = issueRepository.findById(new ObjectId(issueId))
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        return workLogRepository.findByIssueId(issueId);
    }

    @GetMapping("/issue/{issueId}/total")
    public Map<String, Double> getIssueTotal(@PathVariable String issueId, Authentication authentication) {
        Issue issue = issueRepository.findById(new ObjectId(issueId))
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);

        double total = workLogRepository.findByIssueId(issueId).stream()
                .mapToDouble(WorkLog::getHours)
                .sum();
        return Map.of("totalHours", total);
    }

    @GetMapping("/sprint/{sprintId}/total")
    public Map<String, Double> getSprintTotal(@PathVariable String sprintId, Authentication authentication) {
        var sprint = sprintRepository.findById(new ObjectId(sprintId))
                .orElseThrow(() -> new RuntimeException("Sprint not found"));
        accessControlService.requireProjectAccess(sprint.getProjectId(), authentication);

        List<String> issueIds = issueRepository.findBySprintId(sprintId).stream()
                .map(Issue::getId)
                .toList();

        double total = workLogRepository.findByIssueIdIn(issueIds).stream()
                .mapToDouble(WorkLog::getHours)
                .sum();
        return Map.of("totalHours", total);
    }

    @GetMapping("/sprint/{sprintId}/breakdown")
    public List<Map<String, Object>> getSprintBreakdown(@PathVariable String sprintId, Authentication authentication) {
        var sprint = sprintRepository.findById(new ObjectId(sprintId))
                .orElseThrow(() -> new RuntimeException("Sprint not found"));
        accessControlService.requireProjectAccess(sprint.getProjectId(), authentication);

        List<Issue> sprintIssues = issueRepository.findBySprintId(sprintId);
        List<Map<String, Object>> breakdown = new ArrayList<>();

        for (Issue issue : sprintIssues) {
            double total = workLogRepository.findByIssueId(issue.getId()).stream()
                    .mapToDouble(WorkLog::getHours)
                    .sum();
            if (total > 0) {
                Map<String, Object> entry = new HashMap<>();
                entry.put("issueId", issue.getId());
                entry.put("issueKey", issue.getKey());
                entry.put("issueTitle", issue.getTitle());
                entry.put("status", issue.getStatus());
                entry.put("totalHours", total);
                breakdown.add(entry);
            }
        }

        return breakdown;
    }

    @PutMapping("/{id}")
    public WorkLog updateWorkLog(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            Authentication authentication) {

        WorkLog log = workLogRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Work log not found"));

        Issue issue = issueRepository.findById(new ObjectId(log.getIssueId()))
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        String userId = accessControlService.currentUserId(authentication);
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        requireModifyRights(issue, userId);

        LocalDate newDate = LocalDate.parse((String) body.get("date"));
        double newHours = ((Number) body.get("hours")).doubleValue();
        String newDescription = (String) body.get("description");

        validateWorkLog(newDate, newHours, newDescription);

        List<String> changes = new ArrayList<>();
        if (log.getHours() != newHours) {
            changes.add(String.format("hours %sh → %sh", log.getHours(), newHours));
        }
        if (!log.getDate().equals(newDate)) {
            changes.add(String.format("date %s → %s", log.getDate(), newDate));
        }
        if (!java.util.Objects.equals(log.getDescription(), newDescription)) {
            changes.add(String.format("description \"%s\" → \"%s\"", log.getDescription(), newDescription));
        }

        log.setDate(newDate);
        log.setHours(newHours);
        log.setDescription(newDescription);
        log.setUpdatedAt(Instant.now());

        WorkLog saved = workLogRepository.save(log);

        String details = changes.isEmpty()
                ? "Saved with no actual changes"
                : "Updated " + String.join(", ", changes);
        recordAudit("UPDATE", saved, issue, userId, details);

        return saved;
    }

    @DeleteMapping("/{id}")
    public void deleteWorkLog(@PathVariable String id, Authentication authentication) {
        WorkLog log = workLogRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Work log not found"));

        Issue issue = issueRepository.findById(new ObjectId(log.getIssueId()))
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        String userId = accessControlService.currentUserId(authentication);
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        requireModifyRights(issue, userId);

        String details = String.format(
                "Deleted entry: %sh on %s — \"%s\"", log.getHours(), log.getDate(), log.getDescription());
        recordAudit("DELETE", log, issue, userId, details);

        workLogRepository.deleteById(new ObjectId(id));
    }

    private void requireModifyRights(Issue issue, String userId) {
        Project project = projectrepository.findById(new ObjectId(issue.getProjectId()))
                .orElseThrow(() -> new RuntimeException("Project not found"));

        boolean isAssignee = userId.equals(issue.getAssigneeId());
        boolean isProjectManager = userId.equals(project.getOwnerId());

        if (!isAssignee && !isProjectManager) {
            throw new RuntimeException("Access denied: only the task assignee or project manager can modify time entries");
        }
    }

    private void validateWorkLog(LocalDate date, double hours, String description) {
        if (date == null) {
            throw new RuntimeException("Invalid: date is required");
        }
        if (date.isAfter(LocalDate.now())) {
            throw new RuntimeException("Invalid: cannot log time for a future date");
        }
        if (hours <= 0) {
            throw new RuntimeException("Invalid: duration must be greater than zero");
        }
        if (description == null || description.isBlank()) {
            throw new RuntimeException("Invalid: description is required");
        }
    }

    private void recordAudit(String action, WorkLog log, Issue issue, String userId, String details) {
        AuditLog entry = new AuditLog();
        entry.setAction(action);
        entry.setEntityType("WORK_LOG");
        entry.setEntityId(log.getId());
        entry.setProjectId(log.getProjectId());
        entry.setIssueId(issue.getId());
        entry.setIssueKey(issue.getKey());
        entry.setIssueTitle(issue.getTitle());
        entry.setPerformedBy(userId);
        entry.setDetails(details);
        auditLogRepository.save(entry);
    }
}