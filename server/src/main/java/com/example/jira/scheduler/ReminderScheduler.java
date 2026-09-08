package com.example.jira.scheduler;

import com.example.jira.model.Issue;
import com.example.jira.model.Notification;
import com.example.jira.repository.IssueRepository;
import com.example.jira.websocket.NotificationPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
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

    // Runs every 10 minutes — the old hourly cadence was fine for a single
    // "day before" reminder, but is too coarse for a 90-minutes-before tier,
    // which could fall entirely inside one of those hour-long gaps.
    // Applies to every issue with a due date regardless of sprint — a
    // backlog issue that's never been pulled into a sprint is just as
    // capable of being overdue as one sitting on an active board.
    @Scheduled(cron = "0 */10 * * * *")
    public void sendDueDateReminders() {
        LocalDateTime now = LocalDateTime.now();

        fireTier(now.plusHours(24), Issue::isReminder24hSent, Issue::setReminder24hSent, "is due in 24 hours.");
        fireTier(now.plusHours(10), Issue::isReminder10hSent, Issue::setReminder10hSent, "is due in 10 hours.");
        fireTier(now.plusMinutes(90), Issue::isReminder90mSent, Issue::setReminder90mSent, "is due in 90 minutes.");
    }

    // Each tier independently pulls every not-yet-Done issue whose due date
    // has entered that tier's window (due date <= threshold), then skips
    // whichever of those already got THIS tier's reminder. The per-issue,
    // per-tier boolean is persisted immediately, before the notification is
    // even sent — first priority per the spec is no duplicate notifications
    // for the same event, so the flag is written as the very next thing
    // after being read, minimizing the window in which an overlapping run
    // (or the job firing again before this save lands) could see it still
    // false and re-send. The three tiers are independent of each other by
    // design: an issue can and should collect all three as it approaches
    // its due date, each exactly once.
    private void fireTier(
            LocalDateTime threshold,
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
