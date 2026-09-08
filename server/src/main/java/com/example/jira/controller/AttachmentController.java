package com.example.jira.controller;

import com.example.jira.model.Attachment;
import com.example.jira.model.Issue;
import com.example.jira.repository.AttachmentRepository;
import com.example.jira.repository.IssueRepository;
import com.example.jira.security.AccessControlService;
import com.example.jira.service.FileStorageService;
import com.example.jira.websocket.RealtimeEventPublisher;
import org.bson.types.ObjectId;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class AttachmentController {

    private final AttachmentRepository attachmentRepository;
    private final IssueRepository issueRepository;
    private final AccessControlService accessControlService;
    private final FileStorageService fileStorageService;
    private final RealtimeEventPublisher realtimeEventPublisher;

    public AttachmentController(
            AttachmentRepository attachmentRepository,
            IssueRepository issueRepository,
            AccessControlService accessControlService,
            FileStorageService fileStorageService,
            RealtimeEventPublisher realtimeEventPublisher) {
        this.attachmentRepository = attachmentRepository;
        this.issueRepository = issueRepository;
        this.accessControlService = accessControlService;
        this.fileStorageService = fileStorageService;
        this.realtimeEventPublisher = realtimeEventPublisher;
    }

    @PostMapping("/issues/{issueId}/attachments")
    public Attachment upload(
            @PathVariable String issueId,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {

        Issue issue = issueRepository.findById(new ObjectId(issueId))
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        String userId = accessControlService.currentUserId(authentication);

        fileStorageService.validate(file);
        String storedFilename = fileStorageService.store(file);

        Attachment attachment = new Attachment();
        attachment.setIssueId(issueId);
        attachment.setProjectId(issue.getProjectId());
        attachment.setUploadedBy(userId);
        attachment.setOriginalFilename(file.getOriginalFilename());
        attachment.setStoredFilename(storedFilename);
        attachment.setContentType(file.getContentType());
        attachment.setSizeBytes(file.getSize());

        Attachment saved = attachmentRepository.save(attachment);

        realtimeEventPublisher.publishIssueEvent("ATTACHMENT_ADDED", saved.getProjectId(), userId, saved);

        return saved;
    }

    @GetMapping("/issues/{issueId}/attachments")
    public List<Attachment> listForIssue(@PathVariable String issueId, Authentication authentication) {
        Issue issue = issueRepository.findById(new ObjectId(issueId))
                .orElseThrow(() -> new RuntimeException("Issue not found"));
        accessControlService.requireProjectAccess(issue.getProjectId(), authentication);
        return attachmentRepository.findByIssueId(issueId);
    }

    @GetMapping("/attachments/{id}/download")
    public ResponseEntity<Resource> download(@PathVariable String id, Authentication authentication) {
        Attachment attachment = attachmentRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Attachment not found"));
        accessControlService.requireProjectAccess(attachment.getProjectId(), authentication);

        Resource resource = fileStorageService.loadAsResource(attachment.getStoredFilename());

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(
                        attachment.getContentType() != null ? attachment.getContentType() : "application/octet-stream"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + attachment.getOriginalFilename() + "\"")
                .body(resource);
    }

    @DeleteMapping("/attachments/{id}")
    public void delete(@PathVariable String id, Authentication authentication) {
        Attachment attachment = attachmentRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Attachment not found"));

        accessControlService.requireProjectAccess(attachment.getProjectId(), authentication);
        String userId = accessControlService.currentUserId(authentication);

        boolean isUploader = userId.equals(attachment.getUploadedBy());

        if (!isUploader) {
            try {
                accessControlService.requireProjectOwner(attachment.getProjectId(), authentication);
            } catch (RuntimeException e) {
                throw new RuntimeException("Access denied: only the uploader or project manager can delete this attachment");
            }
        }

        fileStorageService.delete(attachment.getStoredFilename());
        attachmentRepository.deleteById(new ObjectId(id));

        realtimeEventPublisher.publishIssueEvent(
                "ATTACHMENT_REMOVED", attachment.getProjectId(), userId,
                Map.of("id", id, "issueId", attachment.getIssueId()));
    }
}