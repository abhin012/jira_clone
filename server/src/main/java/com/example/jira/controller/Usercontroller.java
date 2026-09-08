package com.example.jira.controller;
import com.example.jira.dto.AuthResponse;
import com.example.jira.dto.UserSummary;
import com.example.jira.security.AccessControlService;
import com.example.jira.security.JwtUtil;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import com.example.jira.service.EmailService;
import org.springframework.beans.factory.annotation.Value;
import com.example.jira.model.User;
import com.example.jira.repository.UserRepository;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/users")
public class Usercontroller {
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private AccessControlService accessControlService;

    @Autowired
    private EmailService emailService;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @PostMapping("/check-email")
    public Map<String, String> checkEmail(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        var existing = userRepository.findByEmail(email);

        String status;
        if (existing.isEmpty()) {
            status = "NEW";
        } else if (existing.get().getPassword() == null) {
            status = "NEEDS_PASSWORD";
        } else {
            status = "HAS_PASSWORD";
        }
        return Map.of("status", status);
    }

    @PostMapping("/signup")
    public AuthResponse signup(@RequestBody User user) {

        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new RuntimeException("Email already exists");
        }

        validatePasswordStrength(user.getPassword());

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRole(user.getRole() == null ? "USER" : user.getRole());

        User saved = userRepository.save(user);
        String token = jwtUtil.generateToken(saved.getId(), saved.getEmail());
        return new AuthResponse(saved, token);
    }

    @PostMapping("/set-password")
    public AuthResponse setPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("No account found for that email"));

        if (user.getPassword() != null) {
            throw new RuntimeException("Invalid: this account already has a password — please log in instead");
        }

        validatePasswordStrength(password);

        user.setPassword(passwordEncoder.encode(password));
        User saved = userRepository.save(user);
        String token = jwtUtil.generateToken(saved.getId(), saved.getEmail());
        return new AuthResponse(saved, token);
    }

    @PostMapping("/invite")
    public UserSummary invite(@RequestBody Map<String, String> body) {
        String name = body.get("name");
        String email = body.get("email");
        String group = body.getOrDefault("group", "General");
        String avatar = body.get("avatar");

        if (userRepository.findByEmail(email).isPresent()) {
            throw new RuntimeException("Email already exists");
        }

        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(null);
        user.setRole("MEMBER");
        user.setGroup(group);
        user.setAvatar(avatar);

        User saved = userRepository.save(user);
        return new UserSummary(saved);
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody User loginRequest) {

        User user = userRepository.findByEmail(loginRequest.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getPassword() == null) {
            throw new RuntimeException("Invalid: this account has no password set yet");
        }

        if (!passwordEncoder.matches(
                loginRequest.getPassword(),
                user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        if (!user.isActive()) {
            throw new RuntimeException("Invalid: this account has been deactivated");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        return new AuthResponse(user, token);
    }

    @GetMapping("/by-email")
    public UserSummary getUserByEmail(@RequestParam String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("No account found for that email"));
        return new UserSummary(user);
    }

    @GetMapping("/{id}")
    public User getUserById(@PathVariable String id) {

        ObjectId objectId;
        try {
            objectId = new ObjectId(id);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid user id");
        }

        return userRepository.findById(objectId)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    @PutMapping("/{id}")
    public User editProfile(
            @PathVariable String id,
            @RequestBody User updatedUser,
            Authentication authentication) {

        requireSelf(id, authentication);

        ObjectId objectId;
        try {
            objectId = new ObjectId(id);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid user id");
        }

        User user = userRepository.findById(objectId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        validateAvatar(updatedUser.getAvatar());

        user.setName(updatedUser.getName());
        user.setGroup(updatedUser.getGroup());
        user.setAvatar(updatedUser.getAvatar());
        user.setPhone(updatedUser.getPhone());

        return userRepository.save(user);
    }

    @PutMapping("/{id}/password")
    public Map<String, String> changePassword(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            Authentication authentication) {

        requireSelf(id, authentication);

        User user = userRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("User not found"));

        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");

        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new RuntimeException("Invalid: current password is incorrect");
        }

        validatePasswordStrength(newPassword);

        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new RuntimeException("Invalid: new password must be different from your current password");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        return Map.of("message", "Password updated successfully");
    }

    @PostMapping("/{id}/email-change-request")
    public Map<String, String> requestEmailChange(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            Authentication authentication) {

        requireSelf(id, authentication);

        User user = userRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("User not found"));

        String newEmail = body.get("newEmail");
        String currentPassword = body.get("currentPassword");
        String method = body.getOrDefault("method", "OTP");

        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new RuntimeException("Invalid: current password is incorrect");
        }

        if (newEmail == null || newEmail.isBlank()) {
            throw new RuntimeException("Invalid: new email is required");
        }

        if (userRepository.findByEmail(newEmail).isPresent()) {
            throw new RuntimeException("Invalid: that email is already in use");
        }

        String otp = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
        String linkToken = UUID.randomUUID().toString();

        user.setPendingEmail(newEmail);
        user.setEmailVerificationToken(otp);
        user.setEmailVerificationLinkToken(linkToken);
        user.setEmailVerificationExpiry(Instant.now().plusSeconds(10 * 60));
        userRepository.save(user);

        String absoluteLink = frontendUrl + "/confirm-email?token=" + linkToken;

        if (emailService.isConfigured()) {
            String html;
            String subject;
            if ("LINK".equals(method)) {
                subject = "Confirm your new email address";
                html = "<p>Hi " + user.getName() + ",</p>"
                        + "<p>Click the link below to confirm your new email address:</p>"
                        + "<p><a href=\"" + absoluteLink + "\">Confirm email change</a></p>"
                        + "<p>This link expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>";
            } else {
                subject = "Your email verification code";
                html = "<p>Hi " + user.getName() + ",</p>"
                        + "<p>Your verification code to confirm your new email address is:</p>"
                        + "<h2 style=\"letter-spacing:4px;\">" + otp + "</h2>"
                        + "<p>This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>";
            }
            try {
                emailService.sendEmail(newEmail, user.getName(), subject, html);
                return Map.of(
                        "message", "LINK".equals(method)
                                ? "A confirmation link was sent to " + newEmail + ". Click it to confirm."
                                : "A 6-digit code was sent to " + newEmail + ". Enter it below to confirm.",
                        "method", method);
            } catch (RuntimeException e) {
                return Map.of(
                        "devOtp", otp,
                        "devLink", absoluteLink,
                        "method", method,
                        "message", "Couldn't send the email (" + e.getMessage() + ") — use the code/link directly instead.");
            }
        } else {
            return Map.of(
                    "devOtp", otp,
                    "devLink", absoluteLink,
                    "method", method,
                    "message", "Email service not configured — use the code/link directly instead.");
        }
    }

    @PutMapping("/{id}/confirm-email")
    public User confirmEmailChange(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            Authentication authentication) {

        requireSelf(id, authentication);

        User user = userRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("User not found"));

        String otp = body.get("otp");
        applyPendingEmailChange(user, otp, null);
        return userRepository.save(user);
    }

    @GetMapping("/confirm-email-link")
    public Map<String, String> confirmEmailByLink(@RequestParam String token) {
        User user = userRepository.findByEmailVerificationLinkToken(token)
                .orElseThrow(() -> new RuntimeException("Invalid or expired verification link"));

        applyPendingEmailChange(user, null, token);
        User saved = userRepository.save(user);

        return Map.of(
                "message", "Email updated successfully.",
                "id", saved.getId(),
                "email", saved.getEmail());
    }

    private void applyPendingEmailChange(User user, String otp, String linkToken) {
        if (user.getPendingEmail() == null) {
            throw new RuntimeException("Invalid: no pending email change found — request a new one first");
        }
        if (user.getEmailVerificationExpiry() == null || user.getEmailVerificationExpiry().isBefore(Instant.now())) {
            throw new RuntimeException("Invalid: verification has expired — request a new one");
        }

        boolean matched;
        if (otp != null) {
            matched = otp.equals(user.getEmailVerificationToken());
        } else {
            matched = linkToken != null && linkToken.equals(user.getEmailVerificationLinkToken());
        }

        if (!matched) {
            throw new RuntimeException("Invalid: incorrect or expired verification " + (otp != null ? "code" : "link"));
        }

        user.setEmail(user.getPendingEmail());
        user.setPendingEmail(null);
        user.setEmailVerificationToken(null);
        user.setEmailVerificationLinkToken(null);
        user.setEmailVerificationExpiry(null);
    }

    @PutMapping("/{id}/notification-preferences")
    public User updateNotificationPreferences(
            @PathVariable String id,
            @RequestBody Map<String, Boolean> body,
            Authentication authentication) {

        requireSelf(id, authentication);

        User user = userRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("User not found"));

        Boolean emailEnabled = body.get("emailNotificationsEnabled");
        if (emailEnabled != null) {
            user.setEmailNotificationsEnabled(emailEnabled);
        }

        return userRepository.save(user);
    }

    @PutMapping("/{id}/deactivate")
    public Map<String, String> deactivateAccount(@PathVariable String id, Authentication authentication) {
        requireSelf(id, authentication);

        User user = userRepository.findById(new ObjectId(id))
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setActive(false);
        userRepository.save(user);

        return Map.of("message", "Account deactivated");
    }

    private void requireSelf(String id, Authentication authentication) {
        String callerId = accessControlService.currentUserId(authentication);
        if (!callerId.equals(id)) {
            throw new RuntimeException("Access denied: you can only manage your own account");
        }
    }

    private void validatePasswordStrength(String password) {
        if (password == null || password.length() < 8) {
            throw new RuntimeException("Invalid: password must be at least 8 characters");
        }
        if (!password.matches(".*[A-Z].*")) {
            throw new RuntimeException("Invalid: password must contain at least one uppercase letter");
        }
        if (!password.matches(".*[a-z].*")) {
            throw new RuntimeException("Invalid: password must contain at least one lowercase letter");
        }
        if (!password.matches(".*[0-9].*")) {
            throw new RuntimeException("Invalid: password must contain at least one number");
        }
        if (!password.matches(".*[^a-zA-Z0-9].*")) {
            throw new RuntimeException("Invalid: password must contain at least one special character");
        }
    }

    private void validateAvatar(String avatar) {
        if (avatar == null || !avatar.startsWith("data:")) {
            return;
        }

        if (!avatar.matches("^data:image/(png|jpeg|jpg|gif|webp);base64,.*")) {
            throw new RuntimeException("Invalid: unsupported image format — use PNG, JPEG, GIF, or WEBP");
        }

        String base64Data = avatar.substring(avatar.indexOf(",") + 1);
        long approxBytes = (long) (base64Data.length() * 0.75);
        long maxBytes = 2L * 1024 * 1024;

        if (approxBytes > maxBytes) {
            throw new RuntimeException("Invalid: profile image must be under 2MB");
        }
    }
}