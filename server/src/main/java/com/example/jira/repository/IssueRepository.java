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

    @Query("{ 'dependsOn': ?0 }")
    List<Issue> findByDependsOnContaining(String issueId);

    List<Issue> findByDueDateLessThanEqualAndStatusNot(
            java.time.Instant threshold, String status);
}