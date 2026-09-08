package com.example.jira.websocket;

import com.example.jira.model.Notification;
import com.example.jira.model.User;
import com.example.jira.repository.NotificationRepository;
import com.example.jira.repository.UserRepository;
import com.example.jira.service.EmailService;
import org.bson.types.ObjectId;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class NotificationPublisher {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final SimpMessagingTemplate messagingTemplate;

    public NotificationPublisher(
            NotificationRepository notificationRepository,
            UserRepository userRepository,
            EmailService emailService,
            SimpMessagingTemplate messagingTemplate) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.messagingTemplate = messagingTemplate;
    }

    public void publish(Notification notification) {
        Notification saved = notificationRepository.save(notification);
        messagingTemplate.convertAndSendToUser(saved.getUserId(), "/queue/notifications", saved);
        maybeSendEmail(saved);
    }

    public void publishIfNotThrottled(
            Notification notification,
            String userId,
            String type,
            String issueId,
            String relatedIssueId,
            Instant since) {

        List<Notification> recent = notificationRepository
                .findByUserIdAndTypeAndIssueIdAndRelatedIssueIdAndCreatedAtAfter(
                        userId, type, issueId, relatedIssueId, since);

        if (recent.isEmpty()) {
            publish(notification);
        }
    }

    private void maybeSendEmail(Notification notification) {
        if (!emailService.isConfigured()) return;

        try {
            User recipient = userRepository.findById(new ObjectId(notification.getUserId())).orElse(null);
            if (recipient == null || !recipient.isEmailNotificationsEnabled()) return;

            String html = "<p>Hi " + recipient.getName() + ",</p><p>" + notification.getMessage() + "</p>";
            emailService.sendEmail(recipient.getEmail(), recipient.getName(), "Jira Clone notification", html);
        } catch (Exception e) {
            System.out.println("Failed to send notification email: " + e.getMessage());
        }
    }
}