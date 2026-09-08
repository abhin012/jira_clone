package com.example.jira;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
// Backs ReminderScheduler.runIfDueAsync() — the opportunistic, request-
// triggered fallback sweep (see JwtAuthFilter) that keeps due-date
// reminders working even when @Scheduled itself can't fire because the
// whole process was asleep. Render's free tier suspends the JVM entirely
// after ~15 minutes with no incoming HTTP traffic; nothing scheduled can
// run during that time, cron included, so the fallback runs the same sweep
// off of ordinary request traffic instead, on whichever thread doesn't
// block the request that triggered it.
@EnableAsync
public class JiraApplication {

	public static void main(String[] args) {
		SpringApplication.run(JiraApplication.class, args);
	}

}