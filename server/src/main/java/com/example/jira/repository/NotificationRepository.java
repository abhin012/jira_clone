package com.example.jira.repository;

import com.example.jira.model.Notification;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface NotificationRepository extends MongoRepository<Notification, ObjectId> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);
    List<Notification> findByUserIdAndReadFalse(String userId);

    List<Notification> findByUserIdAndTypeAndIssueIdAndRelatedIssueIdAndCreatedAtAfter(
            String userId, String type, String issueId, String relatedIssueId, java.time.Instant after);
}