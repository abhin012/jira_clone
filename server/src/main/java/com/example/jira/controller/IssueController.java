package com.example.jira.controller;

import com.example.jira.model.Issue;
import com.example.jira.model.Notification;
import com.example.jira.model.Project;
import com.example.jira.repository.IssueRepository;
import com.example.jira.repository.Projectrepository;
import com.example.jira.security.AccessControlService;
import com.example.jira.websocket.NotificationPublisher;
import com.example.jira.websocket.RealtimeEventPublisher;
import org.bson.types.ObjectId;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/issues")
public class IssueController {

        private final IssueRepository issueRepository;
    private final Projectrepository projectrepository;
    private final AccessControlService accessControlService;
    private final RealtimeEventPublisher realtimeEventPublisher;
    private final NotificationPublisher notificationPublisher;
    private final com.example.jira.repository.AttachmentRepository attachmentRepository;
    private final com.example.jira.service.FileStorageService fileStorageService;

    public IssueController(
            IssueRepository issueRepository,
            Projectrepository projectrepository,
            AccessControlService accessControlService,
            RealtimeEventPublisher realtimeEventPublisher,
            NotificationPublisher notificationPublisher,
            com.example.jira.repository.AttachmentRepository attachmentRepository,
            com.example.jira.service.FileStorageService fileStorageService) {
        this.issueRepository = issueRepository;
        this.projectrepository = projectrepository;
        this.accessControlService = accessControlService;
        this.realtimeEventPublisher = realtimeEventPublisher;
        this.notificationPublisher = notificationPublisher;
        this.attachmentRepository = attachmentRepository;
        this.fileStorageService = fileStorageService;
    }

    // =========================
    // CREATE (also handles subtasks when parentId is set)
    // =========================
    @PostMapping
    public Issue createIssue(@RequestBody Issue issue, Authentication authentication) {
        Issue parent = null;
        String actorUserId = accessControlService.currentUserId(authentication);

        if (issue.getParentId() != null) {
            parent = issueRepository.findById(new ObjectId(issue.getParentId()))
                    .orElseThrow(() -> new RuntimeException("Parent task not found"));
            accessControlService.requireProjectAccess(parent.getProjectId(), authentication);

            issue.setProjectId(parent.getProjectId());
            issue.setSprintId(parent.getSprintId());
        } else {
            accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        }

        if (issue.getKey() == null && issue.getProjectId() != null) {
            String prefix = "ISSUE";
            try {
                Project project = projectrepository.findById(new ObjectId(issue.getProjectId())).orElse(null);
                if (project != null && project.getKey() != null && !project.getKey().isBlank()) {
                    prefix = project.getKey().toUpperCase();
                }
            } catch (IllegalArgumentException ignored) {
            }
            long existingCount = issueRepository.findByProjectId(issue.getProjectId()).size();
            issue.setKey(prefix + "-" + (existingCount + 1));
        }

        validateDueDate(issue.getDueDate());

        issue.setVersion(0);
        Issue saved = issueRepository.save(issue);

        realtimeEventPublisher.publishIssueEvent("ISSUE_CREATED", saved.getProjectId(), actorUserId, saved);

        if (saved.getAssigneeId() != null && !saved.getAssigneeId().equals(actorUserId)) {
            Notification notification = new Notification();
            notification.setUserId(saved.getAssigneeId());
            notification.setIssueId(saved.getId());
            notification.setType("TASK_ASSIGNED");
            notification.setMessage("You've been assigned to \"" + saved.getTitle() + "\".");
            notificationPublisher.publish(notification);
        }

        return saved;
    }

    // =========================
    // GET BY PROJECT
    // =========================
    @GetMapping("/project/{projectId}")
    public List<Issue> getIssuesByProject(@PathVariable String projectId, Authentication authentication) {
        accessControlService.requireProjectAccess(projectId, authentication);
        List<Issue> topLevel = issueRepository.findByProjectId(projectId).stream()
                .filter(i -> i.getParentId() == null)
                .toList();

        for (Issue issue : topLevel) {
            List<Issue> subtasks = issueRepository.findByParentId(issue.getId());
            issue.setSubtaskCount(subtasks.size());
            issue.setSubtaskDoneCount((int) subtasks.stream().filter(s -> "DONE".equals(s.getStatus())).count());
        }

        return topLevel;
    }

    // =========================
    // GET BY ID
    // =========================
    @GetMapping("/{id}")
    public Issue getIssueById(@PathVariable String id, Authentication authentication) {
        Issue issue = issueRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        return issue;
    }

    // =========================
    // GET SUBTASKS OF A PARENT
    // =========================
    @GetMapping("/{id}/subtasks")
    public List<Issue> getSubtasks(@PathVariable String id, Authentication authentication) {
        Issue parent = issueRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        accessControlService.requireProjectAccess(parent.getProjectId(), authentication);
        return issueRepository.findByParentId(id);
    }

    // =========================
    // UPDATE
    // =========================
    @PutMapping("/{id}")
    public Issue updateIssue(
            @PathVariable String id,
            @RequestBody Issue updated,
            Authentication authentication) {

        Issue issue = issueRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Issue not found"));

        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        String actorUserId = accessControlService.currentUserId(authentication);

        if (issue.getVersion() != updated.getVersion()) {
            throw new RuntimeException(
                    "Conflict: this issue was changed by someone else — please refresh and try again");
        }

        String targetStatus = updated.getStatus();
        String previousStatus = issue.getStatus();
        String previousAssigneeId = issue.getAssigneeId();

        if (!targetStatus.equals(previousStatus)) {
            Project statusChangeProject = projectrepository.findById(new ObjectId(issue.getProjectId()))
                    .orElseThrow(() -> new RuntimeException("Project not found"));
            boolean isAssignee = actorUserId.equals(issue.getAssigneeId());
            boolean isProjectManager = actorUserId.equals(statusChangeProject.getOwnerId());

            // Subtasks have no real way to be individually assigned right
            // now, so also allow the PARENT task's assignee to manage them —
            // otherwise an unassigned subtask could only ever be moved by
            // the PM, even by the person actually responsible for the work.
            boolean isParentAssignee = false;
            if (issue.getParentId() != null) {
                Issue parentForPermission = issueRepository.findById(new ObjectId(issue.getParentId())).orElse(null);
                if (parentForPermission != null) {
                    isParentAssignee = actorUserId.equals(parentForPermission.getAssigneeId());
                }
            }

            if (!isAssignee && !isProjectManager && !isParentAssignee) {
                throw new RuntimeException(
                        "Access denied: only the assignee, the parent task's assignee, or project manager can move this issue");
            }
        }

        String effectiveSprintId = updated.getSprintId();
        if (issue.getParentId() != null) {
            Issue parent = issueRepository.findById(new ObjectId(issue.getParentId())).orElse(null);
            if (parent != null) {
                effectiveSprintId = parent.getSprintId();
            }
        }

        if ("DONE".equals(targetStatus)) {
            List<Issue> subtasks = issueRepository.findByParentId(id);
            List<String> incomplete = subtasks.stream()
                    .filter(s -> !"DONE".equals(s.getStatus()))
                    .map(Issue::getTitle)
                    .toList();
            if (!incomplete.isEmpty()) {
                throw new RuntimeException(
                        "Blocked: complete all subtasks first — still open: " + String.join(", ", incomplete));
            }
        }

        if (!"TODO".equals(targetStatus) && issue.getDependsOn() != null && !issue.getDependsOn().isEmpty()) {
            List<String> blockerTitles = new ArrayList<>();
            for (String depId : issue.getDependsOn()) {
                Issue dep = issueRepository.findById(new ObjectId(depId)).orElse(null);
                if (dep != null && !"DONE".equals(dep.getStatus())) {
                    blockerTitles.add(dep.getTitle());
                    notifyBlockerOwner(issue, dep);
                }
            }
            if (!blockerTitles.isEmpty()) {
                throw new RuntimeException("Blocked by: " + String.join(", ", blockerTitles));
            }
        }

        validateDueDate(updated.getDueDate());

        boolean dueDateChanged = !Objects.equals(issue.getDueDate(), updated.getDueDate());

        issue.setTitle(updated.getTitle());
        issue.setDescription(updated.getDescription());
        issue.setStatus(targetStatus);
        issue.setPriority(updated.getPriority());
        issue.setAssigneeId(updated.getAssigneeId());
        issue.setSprintId(effectiveSprintId);
        issue.setOrder(updated.getOrder());
        issue.setUpdatedAt(Instant.now());
        issue.setComments(updated.getComments());
        issue.setDueDate(updated.getDueDate());
        if (dueDateChanged) {
            // A rescheduled due date should get its full 24h/10h/90m
            // reminder sequence again, not just whichever tier happens to
            // still be in front of it.
            issue.setReminder24hSent(false);
            issue.setReminder10hSent(false);
            issue.setReminder90mSent(false);
        }
        issue.setVersion(issue.getVersion() + 1);

        Issue saved = issueRepository.save(issue);

        if ("DONE".equals(targetStatus) && !"DONE".equals(previousStatus)) {
            notifyDependents(saved);
            clearCompletedDependencyFromDependents(saved);
        }

        // Task assignment — only when it's a genuinely new assignee, and
        // not when someone assigns the task to themselves.
        boolean assigneeChanged = !Objects.equals(previousAssigneeId, saved.getAssigneeId());
        if (assigneeChanged && saved.getAssigneeId() != null && !saved.getAssigneeId().equals(actorUserId)) {
            Notification assignNotification = new Notification();
            assignNotification.setUserId(saved.getAssigneeId());
            assignNotification.setIssueId(saved.getId());
            assignNotification.setType("TASK_ASSIGNED");
            assignNotification.setMessage("You've been assigned to \"" + saved.getTitle() + "\".");
            notificationPublisher.publish(assignNotification);
        }

        // Status change — tell the assignee and reporter, skipping whichever
        // of them is the actor themselves (no need to notify yourself).
        if (!targetStatus.equals(previousStatus)) {
            Set<String> statusRecipients = new HashSet<>();
            if (saved.getAssigneeId() != null) statusRecipients.add(saved.getAssigneeId());
            if (saved.getReporterId() != null) statusRecipients.add(saved.getReporterId());
            statusRecipients.remove(actorUserId);

            for (String recipientId : statusRecipients) {
                Notification statusNotification = new Notification();
                statusNotification.setUserId(recipientId);
                statusNotification.setIssueId(saved.getId());
                statusNotification.setType("STATUS_CHANGED");
                statusNotification.setMessage(
                        "\"" + saved.getTitle() + "\" moved to " + targetStatus.replace("_", " ") + ".");
                notificationPublisher.publish(statusNotification);
            }
        }

        realtimeEventPublisher.publishIssueEvent("ISSUE_UPDATED", saved.getProjectId(), actorUserId, saved);

        return saved;
    }

            private void validateDueDate(java.time.LocalDateTime dueDate) {
        if (dueDate == null) return;
        if (dueDate.isBefore(java.time.LocalDateTime.now())) {
            throw new RuntimeException("Invalid: due date cannot be in the past");
        }
        if (dueDate.isAfter(java.time.LocalDateTime.now().plusYears(5))) {
            throw new RuntimeException("Invalid: due date cannot be more than 5 years out");
        }
    }

    private void notifyDependents(Issue completedIssue) {
        List<Issue> dependents = issueRepository.findByDependsOnContaining(completedIssue.getId());
        for (Issue dependent : dependents) {
            String recipientId = dependent.getAssigneeId() != null
                    ? dependent.getAssigneeId()
                    : dependent.getReporterId();
            if (recipientId == null) continue;

            Notification notification = new Notification();
            notification.setUserId(recipientId);
            notification.setIssueId(dependent.getId());
            notification.setMessage(
                    "\"" + completedIssue.getTitle() + "\" is now Done — \""
                            + dependent.getTitle() + "\" is no longer blocked.");
            notificationPublisher.publish(notification);
        }
    }

    // Once a task is Done, it can't block anything anymore — strip it out of
    // the dependsOn list of every task that was waiting on it, immediately.
    // Only the completed task is removed from THEIR list; the reverse edge
    // (tasks that depend on the one we just completed) is untouched, and any
    // OTHER still-open blockers those dependents have stay in place.
    // actorUserId is intentionally left null on the realtime event below —
    // this is a side effect of completing a different issue, not something
    // the caller's own client already applied locally, so even the actor's
    // own board needs to refetch to see the dependents' cards unblock.
    private void clearCompletedDependencyFromDependents(Issue completedIssue) {
        List<Issue> dependents = issueRepository.findByDependsOnContaining(completedIssue.getId());
        for (Issue dependent : dependents) {
            List<String> deps = new ArrayList<>(dependent.getDependsOn());
            deps.remove(completedIssue.getId());
            dependent.setDependsOn(deps);
            dependent.setUpdatedAt(Instant.now());
            dependent.setVersion(dependent.getVersion() + 1);
            Issue savedDependent = issueRepository.save(dependent);
            realtimeEventPublisher.publishIssueEvent(
                    "ISSUE_UPDATED", savedDependent.getProjectId(), null, savedDependent);
        }
    }

    // =========================
    // ADD DEPENDENCY (with cycle detection)
    // =========================
    @PutMapping("/{id}/dependencies/{dependsOnId}")
    public Issue addDependency(
            @PathVariable String id,
            @PathVariable String dependsOnId,
            Authentication authentication) {

        if (id.equals(dependsOnId)) {
            throw new RuntimeException("Invalid: a task cannot depend on itself");
        }

        Issue issue = issueRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        String actorUserId = accessControlService.currentUserId(authentication);

        Issue dependsOnIssue = issueRepository.findById(new ObjectId(dependsOnId))
                .orElseThrow(() -> new RuntimeException("Dependency task not found"));

        if (!issue.getProjectId().equals(dependsOnIssue.getProjectId())) {
            throw new RuntimeException("Invalid: dependencies must be within the same project");
        }

        if (wouldCreateCycle(id, dependsOnId)) {
            throw new RuntimeException("Circular dependency: this would create a dependency loop");
        }

        List<String> deps = issue.getDependsOn() != null ? new ArrayList<>(issue.getDependsOn()) : new ArrayList<>();
        if (!deps.contains(dependsOnId)) {
            deps.add(dependsOnId);
        }
        issue.setDependsOn(deps);
        issue.setUpdatedAt(Instant.now());
        issue.setVersion(issue.getVersion() + 1);
        Issue saved = issueRepository.save(issue);

        notifyBlockerOwner(saved, dependsOnIssue);
        realtimeEventPublisher.publishIssueEvent("ISSUE_UPDATED", saved.getProjectId(), actorUserId, saved);

        return saved;
    }

    private void notifyBlockerOwner(Issue blockedIssue, Issue blockingIssue) {
        if ("DONE".equals(blockingIssue.getStatus())) return;

        String recipientId = blockingIssue.getAssigneeId() != null
                ? blockingIssue.getAssigneeId()
                : blockingIssue.getReporterId();
        if (recipientId == null) return;

        Instant fifteenMinutesAgo = Instant.now().minusSeconds(15 * 60);

        Notification notification = new Notification();
        notification.setUserId(recipientId);
        notification.setIssueId(blockingIssue.getId());
        notification.setType("DEPENDENCY_WAITING");
        notification.setRelatedIssueId(blockedIssue.getId());
        notification.setMessage(
                "\"" + blockedIssue.getTitle() + "\" is waiting on you to finish \""
                        + blockingIssue.getTitle() + "\".");

        notificationPublisher.publishIfNotThrottled(notification, recipientId, "DEPENDENCY_WAITING",
                blockingIssue.getId(), blockedIssue.getId(), fifteenMinutesAgo);
    }

    private boolean wouldCreateCycle(String fromId, String toId) {
        Set<String> visited = new HashSet<>();
        Deque<String> stack = new ArrayDeque<>();
        stack.push(toId);

        while (!stack.isEmpty()) {
            String current = stack.pop();
            if (current.equals(fromId)) return true;
            if (!visited.add(current)) continue;

            issueRepository.findById(new ObjectId(current)).ifPresent(currentIssue -> {
                if (currentIssue.getDependsOn() != null) {
                    stack.addAll(currentIssue.getDependsOn());
                }
            });
        }
        return false;
    }

    // =========================
    // REMOVE DEPENDENCY
    // =========================
    @DeleteMapping("/{id}/dependencies/{dependsOnId}")
    public Issue removeDependency(
            @PathVariable String id,
            @PathVariable String dependsOnId,
            Authentication authentication) {

        Issue issue = issueRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        String actorUserId = accessControlService.currentUserId(authentication);

        if (issue.getDependsOn() != null) {
            List<String> deps = new ArrayList<>(issue.getDependsOn());
            deps.remove(dependsOnId);
            issue.setDependsOn(deps);
            issue.setUpdatedAt(Instant.now());
            issue.setVersion(issue.getVersion() + 1);
            issue = issueRepository.save(issue);
            realtimeEventPublisher.publishIssueEvent("ISSUE_UPDATED", issue.getProjectId(), actorUserId, issue);
        }
        return issue;
    }

    // =========================
    // DELETE
    // =========================
        @DeleteMapping("/{id}")
    public void deleteIssue(@PathVariable String id, Authentication authentication) {
        Issue issue = issueRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        String actorUserId = accessControlService.currentUserId(authentication);

        // Deleting a SUBTASK specifically is restricted to its own assignee,
        // its parent's assignee, or the PM — top-level issue deletion stays
        // open to any project member, unchanged.
        if (issue.getParentId() != null) {
            Project project = projectrepository.findById(new ObjectId(issue.getProjectId()))
                    .orElseThrow(() -> new RuntimeException("Project not found"));
            boolean isAssignee = actorUserId.equals(issue.getAssigneeId());
            boolean isProjectManager = actorUserId.equals(project.getOwnerId());
            boolean isParentAssignee = false;
            Issue parent = issueRepository.findById(new ObjectId(issue.getParentId())).orElse(null);
            if (parent != null) {
                isParentAssignee = actorUserId.equals(parent.getAssigneeId());
            }
            if (!isAssignee && !isProjectManager && !isParentAssignee) {
                throw new RuntimeException(
                        "Access denied: only the assignee, the parent task's assignee, or project manager can delete this subtask");
            }
        }

        List<Issue> subtasks = issueRepository.findByParentId(id);
        List<String> allDeletedIssueIds = new ArrayList<>(subtasks.stream().map(Issue::getId).toList());
        allDeletedIssueIds.add(id);

        List<com.example.jira.model.Attachment> attachmentsToDelete =
                attachmentRepository.findByIssueIdIn(allDeletedIssueIds);
        for (com.example.jira.model.Attachment attachment : attachmentsToDelete) {
            fileStorageService.delete(attachment.getStoredFilename());
        }
        attachmentRepository.deleteAll(attachmentsToDelete);

        issueRepository.deleteAll(subtasks);

        List<Issue> dependents = issueRepository.findByDependsOnContaining(id);
        for (Issue dependent : dependents) {
            List<String> deps = new ArrayList<>(dependent.getDependsOn());
            deps.remove(id);
            dependent.setDependsOn(deps);
            dependent.setVersion(dependent.getVersion() + 1);
            issueRepository.save(dependent);
        }

        issueRepository.deleteById(new ObjectId(id));

        Map<String, String> deletedPayload = Map.of("id", id, "projectId", issue.getProjectId());
        realtimeEventPublisher.publishIssueEvent("ISSUE_DELETED", issue.getProjectId(), actorUserId, deletedPayload);
    }
}