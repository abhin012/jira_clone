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

    // Runs every 10 minutes — the old hourly cadence was fine for a single
    // "day before" reminder, but is too coarse for a 90-minutes-before tier,
    // which could fall entirely inside one of those hour-long gaps.
    // Applies to every issue with a due date regardless of sprint — a
    // backlog issue that's never been pulled into a sprint is just as
    // capable of being overdue as one sitting on an active board.
    //
    // This alone isn't sufficient on a host that suspends the whole process
    // when idle (e.g. Render's free tier spins the dyno down after ~15
    // minutes of no HTTP traffic) — nothing scheduled can fire while the
    // JVM itself isn't running. runIfDueAsync() below is the fallback for
    // that: JwtAuthFilter calls it on ordinary request traffic, so as long
    // as anyone is using the app at all, a sweep still happens roughly on
    // schedule even if the cron trigger itself got skipped while asleep.
    @Scheduled(cron = "0 */10 * * * *")
    public void sendDueDateReminders() {
        Instant now = Instant.now();

        fireTier(now.plus(24, ChronoUnit.HOURS), Issue::isReminder24hSent, Issue::setReminder24hSent, "is due in 24 hours.");
        fireTier(now.plus(10, ChronoUnit.HOURS), Issue::isReminder10hSent, Issue::setReminder10hSent, "is due in 10 hours.");
        fireTier(now.plus(90, ChronoUnit.MINUTES), Issue::isReminder90mSent, Issue::setReminder90mSent, "is due in 90 minutes.");
    }

    private static final long MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    private final AtomicLong lastRunEpochMs = new AtomicLong(0);

    // Request-triggered fallback sweep — see the comment on
    // sendDueDateReminders() for why this exists. Throttled to once per 5
    // minutes via compare-and-set so a burst of concurrent requests (e.g.
    // several board tabs polling at once right after the dyno wakes up)
    // triggers at most one sweep, not one per request; the CAS also means
    // only one thread ever proceeds even under real concurrency. @Async so
    // it runs off the request thread — a visitor loading their board should
    // never be made to wait on an unrelated reminder sweep.
    @Async
    public void runIfDueAsync() {
        long now = System.currentTimeMillis();
        long last = lastRunEpochMs.get();
        if (now - last < MIN_INTERVAL_MS) return;
        if (!lastRunEpochMs.compareAndSet(last, now)) return;

        sendDueDateReminders();
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
