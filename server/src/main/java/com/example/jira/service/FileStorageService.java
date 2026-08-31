package com.example.jira.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class FileStorageService {

    private static final long MAX_SIZE_BYTES = 10L * 1024 * 1024; // 10MB

    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf",
            "image/png",
            "image/jpeg",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "png", "jpg", "jpeg", "docx");

    @Value("${app.upload-dir:./uploads}")
    private String uploadDir;

    private Path resolveUploadDir() {
        try {
            Path dir = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(dir);
            return dir;
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize upload directory: " + e.getMessage());
        }
    }

    // Validates size + declared type (content-type header + extension) AND
    // the file's actual byte content — the first two are client-reported
    // and can be spoofed, so the magic-byte check is what actually catches
    // a mislabeled or malicious file rather than just trusting labels.
    public void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("Invalid: no file provided");
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            throw new RuntimeException("Invalid: file exceeds the 10MB size limit");
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new RuntimeException("Invalid: unsupported file type — only PDF, PNG, JPG, and DOCX are allowed");
        }

        String extension = extractExtension(file.getOriginalFilename());
        if (extension == null || !ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
            throw new RuntimeException("Invalid: unsupported file extension — only PDF, PNG, JPG, and DOCX are allowed");
        }

        validateMagicBytes(file, extension.toLowerCase());
    }

    // Checks the file's actual leading bytes against the known signature
    // for its claimed type. DOCX is a special case — it's a ZIP container
    // (the same format family as XLSX/PPTX), so this can only confirm it's
    // a genuine Office Open XML container, not specifically a Word document;
    // true disambiguation would require deeper structural parsing than is
    // reasonable here.
    private void validateMagicBytes(MultipartFile file, String extension) {
        byte[] header = new byte[8];
        try (InputStream is = file.getInputStream()) {
            int read = is.read(header);
            if (read < 4) {
                throw new RuntimeException("Invalid: file appears to be empty or corrupted");
            }
        } catch (IOException e) {
            throw new RuntimeException("Invalid: could not read file to verify its contents");
        }

        boolean matches = switch (extension) {
            case "pdf" -> header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46; // %PDF
            case "png" -> (header[0] & 0xFF) == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47;
            case "jpg", "jpeg" -> (header[0] & 0xFF) == 0xFF && (header[1] & 0xFF) == 0xD8 && (header[2] & 0xFF) == 0xFF;
            case "docx" -> (header[0] & 0xFF) == 0x50 && header[1] == 0x4B; // "PK" — ZIP/OOXML container
            default -> false;
        };

        if (!matches) {
            throw new RuntimeException(
                    "Invalid: file content doesn't match its extension — it may be corrupted or mislabeled");
        }

        if ("docx".equals(extension)) {
            validateDocxContainer(file);
        }
    }

    private void validateDocxContainer(MultipartFile file) {
        try (ZipInputStream zis = new ZipInputStream(file.getInputStream())) {
            ZipEntry entry;
            boolean hasContentTypes = false;
            while ((entry = zis.getNextEntry()) != null) {
                if ("[Content_Types].xml".equals(entry.getName())) {
                    hasContentTypes = true;
                    break;
                }
            }
            if (!hasContentTypes) {
                throw new RuntimeException("Invalid: file doesn't look like a valid Office document");
            }
        } catch (IOException e) {
            throw new RuntimeException("Invalid: file doesn't look like a valid Office document");
        }
    }

    // Server-generated, never derived from client input — this is what
    // actually prevents both filename collisions and any path-traversal
    // risk from a maliciously crafted original filename.
    public String store(MultipartFile file) {
        String extension = extractExtension(file.getOriginalFilename());
        String storedFilename = UUID.randomUUID() + "." + extension;

        try {
            Path target = resolveUploadDir().resolve(storedFilename);
            Files.copy(file.getInputStream(), target);
            return storedFilename;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file: " + e.getMessage());
        }
    }

    public Resource loadAsResource(String storedFilename) {
        try {
            Path filePath = resolveUploadDir().resolve(storedFilename).normalize();
            if (!filePath.startsWith(resolveUploadDir())) {
                throw new RuntimeException("Invalid file path");
            }
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new RuntimeException("File not found on disk");
            }
            return resource;
        } catch (MalformedURLException e) {
            throw new RuntimeException("Invalid file path: " + e.getMessage());
        }
    }

    public void delete(String storedFilename) {
        try {
            Path filePath = resolveUploadDir().resolve(storedFilename).normalize();
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            System.out.println("Failed to delete file " + storedFilename + ": " + e.getMessage());
        }
    }

    public void deleteAll(List<String> storedFilenames) {
        for (String filename : storedFilenames) {
            delete(filename);
        }
    }

    private String extractExtension(String filename) {
        if (filename == null || !filename.contains(".")) return null;
        return filename.substring(filename.lastIndexOf('.') + 1);
    }
}