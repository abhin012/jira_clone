package com.example.jira.scheduler;

import com.example.jira.model.Issue;
import com.example.jira.model.Notification;
import com.example.jira.repository.IssueRepository;
import com.example.jira.websocket.NotificationPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import java.util.function.Predicate;

@Component
public class ReminderScheduler {

    private final IssueRepository issueRepository;
    private final NotificationPublisher notificationPublisher;

    public ReminderScheduler(IssueRepository issueRepository, NotificationPublisher notificationPublisher) {
        this.issueRepository = issueRepository;
        this.notificationPublisher = notificationPublisher;
    }

    @Scheduled(cron = "0 */10 * * * *")
    public void sendDueDateReminders() {
        Instant now = Instant.now();

        fireTier(now.plus(24, ChronoUnit.HOURS), Issue::isReminder24hSent, Issue::setReminder24hSent, "is due in 24 hours.");
        fireTier(now.plus(10, ChronoUnit.HOURS), Issue::isReminder10hSent, Issue::setReminder10hSent, "is due in 10 hours.");
        fireTier(now.plus(90, ChronoUnit.MINUTES), Issue::isReminder90mSent, Issue::setReminder90mSent, "is due in 90 minutes.");
    }

    private static final long MIN_INTERVAL_MS = 5 * 60 * 1000;
    private final AtomicLong lastRunEpochMs = new AtomicLong(0);

    @Async
    public void runIfDueAsync() {
        long now = System.currentTimeMillis();
        long last = lastRunEpochMs.get();
        if (now - last < MIN_INTERVAL_MS) return;
        if (!lastRunEpochMs.compareAndSet(last, now)) return;

        sendDueDateReminders();
    }

    private void fireTier(
            Instant threshold,
            Predicate<Issue> alreadySentForTier,
            BiConsumer<Issue, Boolean> markSentForTier,
            String messageSuffix) {

        List<Issue> candidates = issueRepository.findByDueDateLessThanEqualAndStatusNot(threshold, "DONE");

        for (Issue issue : candidates) {
            if (alreadySentForTier.test(issue)) continue;

            markSentForTier.accept(issue, true);
            issueRepository.save(issue);

            String recipientId = issue.getAssigneeId() != null ? issue.getAssigneeId() : issue.getReporterId();
            if (recipientId == null) continue;

            Notification notification = new Notification();
            notification.setUserId(recipientId);
            notification.setIssueId(issue.getId());
            notification.setType("DUE_DATE_REMINDER");
            notification.setMessage("\"" + issue.getTitle() + "\" " + messageSuffix);
            notificationPublisher.publish(notification);
        }
    }
}
