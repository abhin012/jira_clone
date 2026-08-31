package com.example.jira.dto;

import com.example.jira.model.User;

public class UserSummary {
    private String id;
    private String name;
    private String email;
    private String avatar;

    public UserSummary(User user) {
        this.id = user.getId();
        this.name = user.getName();
        this.email = user.getEmail();
        this.avatar = user.getAvatar();
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getAvatar() { return avatar; }
}