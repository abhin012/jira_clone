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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class WebSocketEventListener {

    private static final Pattern PROJECT_TOPIC_PATTERN =
            Pattern.compile("^/topic/project/([^/]+)(/presence)?$");

    private final PresenceService presenceService;
    private final AccessControlService accessControlService;

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
        }
    }

    @EventListener
    public void handleUnsubscribe(SessionUnsubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        presenceService.onUnsubscribe(accessor.getSessionId());
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        presenceService.onDisconnect(accessor.getSessionId());
    }

    // AccessControlService expects a Spring Security Authentication object;
    // WebSocket sessions authenticate via our own handshake interceptor
    // instead of the normal HTTP filter chain, so we build a minimal
    // stand-in carrying just the userId it actually reads.
    private Authentication syntheticAuth(String userId) {
        return new AnonymousAuthenticationToken(
                "ws", userId, java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_WS")));
    }
}