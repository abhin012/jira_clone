package com.example.jira.security;

import com.example.jira.scheduler.ReminderScheduler;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final ReminderScheduler reminderScheduler;

    public JwtAuthFilter(JwtUtil jwtUtil, ReminderScheduler reminderScheduler) {
        this.jwtUtil = jwtUtil;
        this.reminderScheduler = reminderScheduler;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        // Runs on literally every request through this filter chain — see
        // ReminderScheduler for why: it's the fallback that lets due-date
        // reminders still fire on a host that suspends the process when
        // idle, by piggybacking a throttled sweep on whatever traffic
        // happens to wake it back up, rather than relying solely on
        // @Scheduled (which can't run while the process itself is asleep).
        reminderScheduler.runIfDueAsync();

        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            if (jwtUtil.isTokenValid(token)) {
                String userId = jwtUtil.extractUserId(token);

                var authentication = new UsernamePasswordAuthenticationToken(
                        userId, null, Collections.emptyList());
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }

        filterChain.doFilter(request, response);
    }
}