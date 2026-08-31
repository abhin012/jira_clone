package com.example.jira.controller;

import com.example.jira.model.Notification;
import com.example.jira.repository.NotificationRepository;
import com.example.jira.security.AccessControlService;
import org.bson.types.ObjectId;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final AccessControlService accessControlService;

    public NotificationController(
            NotificationRepository notificationRepository,
            AccessControlService accessControlService) {
        this.notificationRepository = notificationRepository;
        this.accessControlService = accessControlService;
    }

    @GetMapping
    public List<Notification> getMyNotifications(Authentication authentication) {
        String userId = accessControlService.currentUserId(authentication);
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @PutMapping("/{id}/read")
    public Notification markRead(@PathVariable String id, Authentication authentication) {
        String userId = accessControlService.currentUserId(authentication);
        Notification n = notificationRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        if (!userId.equals(n.getUserId())) {
            throw new RuntimeException("Access denied: not your notification");
        }
        n.setRead(true);
        return notificationRepository.save(n);
    }

    @PutMapping("/{id}/unread")
    public Notification markUnread(@PathVariable String id, Authentication authentication) {
        String userId = accessControlService.currentUserId(authentication);
        Notification n = notificationRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        if (!userId.equals(n.getUserId())) {
            throw new RuntimeException("Access denied: not your notification");
        }
        n.setRead(false);
        return notificationRepository.save(n);
    }

    @PutMapping("/read-all")
    public void markAllRead(Authentication authentication) {
        String userId = accessControlService.currentUserId(authentication);
        List<Notification> unread = notificationRepository.findByUserIdAndReadFalse(userId);
        for (Notification n : unread) {
            n.setRead(true);
            notificationRepository.save(n);
        }
    }
}