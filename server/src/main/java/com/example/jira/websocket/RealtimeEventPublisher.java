package com.example.jira.websocket;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class RealtimeEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public RealtimeEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    // type: ISSUE_CREATED | ISSUE_UPDATED | ISSUE_DELETED
    public void publishIssueEvent(String type, String projectId, String actorUserId, Object payload) {
        RealtimeEvent event = new RealtimeEvent();
        event.eventId = UUID.randomUUID().toString();
        event.type = type;
        event.projectId = projectId;
        event.actorUserId = actorUserId;
        event.timestamp = Instant.now().toString();
        event.data = payload;

        messagingTemplate.convertAndSend("/topic/project/" + projectId, event);
    }

        public static class RealtimeEvent {
        public String eventId;
        public String type;
        public String projectId;
        public String actorUserId;
        public String timestamp;
        public Object data;
    }
}