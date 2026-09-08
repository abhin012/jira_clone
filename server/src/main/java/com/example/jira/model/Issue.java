package com.example.jira.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "issues")
public class Issue {

    @Id
    private ObjectId id;

    private String key;
    private String title;
    private String description;
    private String type;
    private String status;
    private String priority;
    private String projectId;
    private String reporterId;
    private String assigneeId;
    private String sprintId;
    private int order;

    // Subtasks: a non-null parentId means this issue IS a subtask.
    // Subtasks inherit projectId/sprintId from their parent and cannot
    // diverge — enforced server-side on every update, not just creation.
    private String parentId;

    // Dependencies: ids of other issues that must be DONE before this
    // issue can move past TODO. Cycle-checked on every addition.
    private List<String> dependsOn;

        private List<Comment> comments;

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    public static class Comment {
        private String authorId;
        private String text;
        private Instant createdAt = Instant.now();

        public String getAuthorId() { return authorId; }
        public void setAuthorId(String authorId) { this.authorId = authorId; }

        public String getText() { return text; }
        public void setText(String text) { this.text = text; }

        public Instant getCreatedAt() { return createdAt; }
        public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    }

    // Manual optimistic-concurrency counter. Incremented on every successful
    // update; a client must send back the version it last saw so we can
    // detect "someone else changed this since you last looked" conflicts.
    private long version = 0;

        // Absolute instant (UTC), not a timezone-naive wall-clock value —
    // the client converts using the browser's own timezone before
    // sending it (see dateUtils.ts). Anything comparing this to "now"
    // must use Instant.now(), never LocalDateTime.now(), or the
    // comparison silently drifts by the server's own UTC offset from
    // whatever timezone actually set the date.
    private Instant dueDate;

    // Guarantees each due-date reminder tier fires exactly once per due
    // date, regardless of how many times the scheduled job runs — one flag
    // per tier so the 24h/10h/90m-before reminders are independent of each
    // other. Reset together whenever the due date itself changes (see
    // IssueController) so a rescheduled task gets the full sequence again.
    private boolean reminder24hSent = false;
    private boolean reminder10hSent = false;
    private boolean reminder90mSent = false;

    // Computed at read time only — never persisted. @Transient prevents
    // Spring Data from writing these into the actual Mongo document on
    // save(), which would otherwise silently corrupt stored data.
    @org.springframework.data.annotation.Transient
    private int subtaskCount = 0;

    @org.springframework.data.annotation.Transient
    private int subtaskDoneCount = 0;

    public String getId() {
        return id != null ? id.toHexString() : null;
    }

    public ObjectId getObjectId() {
        return id;
    }

    public void setId(ObjectId id) {
        this.id = id;
    }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getReporterId() { return reporterId; }
    public void setReporterId(String reporterId) { this.reporterId = reporterId; }

    public String getAssigneeId() { return assigneeId; }
    public void setAssigneeId(String assigneeId) { this.assigneeId = assigneeId; }

    public String getSprintId() { return sprintId; }
    public void setSprintId(String sprintId) { this.sprintId = sprintId; }

    public int getOrder() { return order; }
    public void setOrder(int order) { this.order = order; }

    public String getParentId() { return parentId; }
    public void setParentId(String parentId) { this.parentId = parentId; }

    public List<String> getDependsOn() { return dependsOn; }
    public void setDependsOn(List<String> dependsOn) { this.dependsOn = dependsOn; }

    public List<Comment> getComments() { return comments; }
    public void setComments(List<Comment> comments) { this.comments = comments; }

    public int getSubtaskCount() { return subtaskCount; }
    public void setSubtaskCount(int subtaskCount) { this.subtaskCount = subtaskCount; }

    public int getSubtaskDoneCount() { return subtaskDoneCount; }
    public void setSubtaskDoneCount(int subtaskDoneCount) { this.subtaskDoneCount = subtaskDoneCount; }
    public Instant getCreatedAt() { return createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }

        public Instant getDueDate() { return dueDate; }
    public void setDueDate(Instant dueDate) { this.dueDate = dueDate; }

    public boolean isReminder24hSent() { return reminder24hSent; }
    public void setReminder24hSent(boolean reminder24hSent) { this.reminder24hSent = reminder24hSent; }

    public boolean isReminder10hSent() { return reminder10hSent; }
    public void setReminder10hSent(boolean reminder10hSent) { this.reminder10hSent = reminder10hSent; }

    public boolean isReminder90mSent() { return reminder90mSent; }
    public void setReminder90mSent(boolean reminder90mSent) { this.reminder90mSent = reminder90mSent; }
}