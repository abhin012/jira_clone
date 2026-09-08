package com.example.jira.websocket;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@Service
public class PresenceService {

    private final SimpMessagingTemplate messagingTemplate;

    private final Map<String, Set<String>> activeUsersByProject = new ConcurrentHashMap<>();

    private final Map<String, String[]> sessionInfo = new ConcurrentHashMap<>();

    public PresenceService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public java.util.Set<String> getActiveUsers(String projectId) {
        return activeUsersByProject.getOrDefault(projectId, java.util.Set.of());
    }
    public void onSubscribe(String sessionId, String projectId, String userId) {
        activeUsersByProject
                .computeIfAbsent(projectId, k -> new CopyOnWriteArraySet<>())
                .add(userId);
        sessionInfo.put(sessionId, new String[] { projectId, userId });
        broadcastPresence(projectId);
    }

    public void onUnsubscribe(String sessionId) {
        removeSession(sessionId);
    }

    public void onDisconnect(String sessionId) {
        removeSession(sessionId);
    }

    private void removeSession(String sessionId) {
        String[] info = sessionInfo.remove(sessionId);
        if (info == null) return;

        String projectId = info[0];
        String userId = info[1];

        Set<String> users = activeUsersByProject.get(projectId);
        if (users != null) {
            users.remove(userId);
        }
        broadcastPresence(projectId);
    }

    private void broadcastPresence(String projectId) {
        Set<String> users = activeUsersByProject.getOrDefault(projectId, Set.of());
        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/presence", users);
    }
}