package com.example.jira.websocket;

import com.example.jira.security.AccessControlService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import java.security.Principal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class WebSocketEventListener {

    private static final Pattern PROJECT_TOPIC_PATTERN =
            Pattern.compile("^/topic/project/([^/]+)(/presence)?$");

    private final PresenceService presenceService;
    private final AccessControlService accessControlService;

    private final java.util.Set<String> presenceTrackedSubscriptions = ConcurrentHashMap.newKeySet();

    public WebSocketEventListener(PresenceService presenceService, AccessControlService accessControlService) {
        this.presenceService = presenceService;
        this.accessControlService = accessControlService;
    }

    @EventListener
    public void handleSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = accessor.getDestination();
        if (destination == null) return;

        Matcher matcher = PROJECT_TOPIC_PATTERN.matcher(destination);
        if (!matcher.matches()) return;

        String projectId = matcher.group(1);
        boolean isPresenceTopic = matcher.group(2) != null;

        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        String userId = sessionAttributes != null ? (String) sessionAttributes.get("userId") : null;
        if (userId == null) return;

        try {
            accessControlService.requireProjectAccess(projectId, syntheticAuth(userId));
        } catch (RuntimeException e) {
            System.out.println("WS subscribe denied — project=" + projectId + " user=" + userId + " reason=" + e.getMessage());
            return;
        }

        if (!isPresenceTopic) {
            presenceService.onSubscribe(accessor.getSessionId(), projectId, userId);
            presenceTrackedSubscriptions.add(subscriptionKey(accessor.getSessionId(), accessor.getSubscriptionId()));
        }
    }

    @EventListener
    public void handleUnsubscribe(SessionUnsubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String key = subscriptionKey(accessor.getSessionId(), accessor.getSubscriptionId());

        if (presenceTrackedSubscriptions.remove(key)) {
            presenceService.onUnsubscribe(accessor.getSessionId());
        }
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        presenceTrackedSubscriptions.removeIf(key -> key.startsWith(sessionId + ":"));
        presenceService.onDisconnect(sessionId);
    }

    private static String subscriptionKey(String sessionId, String subscriptionId) {
        return sessionId + ":" + subscriptionId;
    }

    private Authentication syntheticAuth(String userId) {
        return new AnonymousAuthenticationToken(
                "ws", userId, java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_WS")));
    }
}