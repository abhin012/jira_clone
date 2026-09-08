package com.example.jira.model;

import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "notifications")
public class Notification {

    @Id
    private ObjectId id;

    private String userId;
    private String message;
    private String issueId;
    private String type;
    private String relatedIssueId;
    private boolean read = false;
    private Instant createdAt = Instant.now();

    public String getId() { return id != null ? id.toHexString() : null; }
    public void setId(ObjectId id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getIssueId() { return issueId; }
    public void setIssueId(String issueId) { this.issueId = issueId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getRelatedIssueId() { return relatedIssueId; }
    public void setRelatedIssueId(String relatedIssueId) { this.relatedIssueId = relatedIssueId; }

    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}