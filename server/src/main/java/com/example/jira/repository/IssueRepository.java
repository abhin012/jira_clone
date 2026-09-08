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

    // Every not-yet-completed issue whose due date has entered a reminder
    // tier's window (due date <= threshold) — used once per tier by
    // ReminderScheduler, which then filters out issues that already got
    // THAT tier's reminder. Matching on "<= threshold" rather than a narrow
    // time slice means a tier can't be silently skipped by the job running
    // a little late or missing a beat after a restart.
    List<Issue> findByDueDateLessThanEqualAndStatusNot(
            java.time.Instant threshold, String status);
}