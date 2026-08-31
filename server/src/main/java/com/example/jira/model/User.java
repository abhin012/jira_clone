package com.example.jira.model;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.bson.types.ObjectId;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "users")
public class User {

    @Id
    private ObjectId id;
    private String name;
    private String email;
    private String phone;

    // Write-only: accepted when parsing signup/login/set-password request
    // bodies, but never included in any JSON response — no endpoint should
    // ever send a password hash back to the browser.
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;
    private String role;
    private String group;
    private String avatar;
    private Instant createdAt = Instant.now();

        private boolean active = true;
    private boolean emailNotificationsEnabled = true;

        // Pending-email-change verification state. Both a code and a link
    // token are issued on every request, regardless of which method the
    // user picks — the confirm step just checks whichever one arrives.
    private String pendingEmail;
    private String emailVerificationToken;
    private String emailVerificationLinkToken;
    private Instant emailVerificationExpiry;

    public String getId() {
        return id != null ? id.toHexString() : null;
    }

    public ObjectId getObjectId() {
        return id;
    }

    public void setId(ObjectId id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getGroup() {
        return group;
    }

    public void setGroup(String group) {
        this.group = group;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public boolean isEmailNotificationsEnabled() {
        return emailNotificationsEnabled;
    }

    public void setEmailNotificationsEnabled(boolean emailNotificationsEnabled) {
        this.emailNotificationsEnabled = emailNotificationsEnabled;
    }

    public String getPendingEmail() {
        return pendingEmail;
    }

    public void setPendingEmail(String pendingEmail) {
        this.pendingEmail = pendingEmail;
    }

        public String getEmailVerificationToken() {
        return emailVerificationToken;
    }

    public void setEmailVerificationToken(String emailVerificationToken) {
        this.emailVerificationToken = emailVerificationToken;
    }

    public String getEmailVerificationLinkToken() {
        return emailVerificationLinkToken;
    }

    public void setEmailVerificationLinkToken(String emailVerificationLinkToken) {
        this.emailVerificationLinkToken = emailVerificationLinkToken;
    }

    public Instant getEmailVerificationExpiry() {
        return emailVerificationExpiry;
    }

    public void setEmailVerificationExpiry(Instant emailVerificationExpiry) {
        this.emailVerificationExpiry = emailVerificationExpiry;
    }
}