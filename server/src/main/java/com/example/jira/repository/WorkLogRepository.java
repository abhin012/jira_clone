package com.example.jira.repository;

import com.example.jira.model.WorkLog;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface WorkLogRepository extends MongoRepository<WorkLog, ObjectId> {
    List<WorkLog> findByIssueId(String issueId);
    List<WorkLog> findByIssueIdIn(List<String> issueIds);
    List<WorkLog> findByProjectId(String projectId);
}