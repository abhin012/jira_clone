package com.example.jira.repository;

import com.example.jira.model.Issue;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import java.util.List;

public interface IssueRepository extends MongoRepository<Issue, ObjectId> {

    List<Issue> findByProjectId(String projectId);
    List<Issue> findBySprintId(String sprintId);
    List<Issue> findByParentId(String parentId);

    // Finds every issue that lists the given id in its dependsOn array —
    // used to notify dependents when a blocking issue is marked Done, and
    // to clean up stale references when an issue is deleted.
    @Query("{ 'dependsOn': ?0 }")
    List<Issue> findByDependsOnContaining(String issueId);

    List<Issue> findByDueDateAndReminderSentFalse(java.time.LocalDate dueDate);    List<Issue> findByDueDateBetweenAndReminderSentFalse(
            java.time.LocalDateTime start, java.time.LocalDateTime end);
}