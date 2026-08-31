package com.example.jira.scheduler;

import com.example.jira.model.Issue;
import com.example.jira.model.Notification;
import com.example.jira.repository.IssueRepository;
import com.example.jira.websocket.NotificationPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public class ReminderScheduler {

    private final IssueRepository issueRepository;
    private final NotificationPublisher notificationPublisher;

    public ReminderScheduler(IssueRepository issueRepository, NotificationPublisher notificationPublisher) {
        this.issueRepository = issueRepository;
        this.notificationPublisher = notificationPublisher;
    }

    // Runs at the top of every hour. Due dates are day-level, so "24 hours
    // before deadline" is approximated as "the day before the due date" —
    // reminderSent guarantees this only ever fires once per issue.
        @Scheduled(cron = "0 0 * * * *")
    public void sendDueDateReminders() {
        java.time.LocalDateTime windowStart = java.time.LocalDateTime.now().plusDays(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        java.time.LocalDateTime windowEnd = windowStart.plusDays(1);
        List<Issue> dueTomorrow = issueRepository.findByDueDateBetweenAndReminderSentFalse(windowStart, windowEnd);

        for (Issue issue : dueTomorrow) {
            if (!"DONE".equals(issue.getStatus())) {
                String recipientId = issue.getAssigneeId() != null ? issue.getAssigneeId() : issue.getReporterId();
                if (recipientId != null) {
                    Notification notification = new Notification();
                    notification.setUserId(recipientId);
                    notification.setIssueId(issue.getId());
                    notification.setType("DUE_DATE_REMINDER");
                    notification.setMessage("\"" + issue.getTitle() + "\" is due tomorrow.");
                    notificationPublisher.publish(notification);
                }
            }
            issue.setReminderSent(true);
            issueRepository.save(issue);
        }
    }
}