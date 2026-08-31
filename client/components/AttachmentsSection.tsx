"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Paperclip, Download, X } from "lucide-react";
import axiosInstance from "@/lib/Axiosinstance";
import { useAuth } from "@/lib/AuthContext";
import { getUserById } from "@/lib/userCache";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AttachmentRow = ({ attachment, canDelete, onDelete }: any) => {
  const { user } = useAuth();
  const [uploader, setUploader] = useState<any>(null);

  useEffect(() => {
    if (!attachment?.uploadedBy) return;
    getUserById(attachment.uploadedBy).then(setUploader);
  }, [attachment?.uploadedBy]);

  const handleDownload = async () => {
    try {
      const res = await axiosInstance.get(`/api/attachments/${attachment.id}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", attachment.originalFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download file");
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md border border-[#DFE1E6] p-2">
      <div className="flex items-center gap-2 min-w-0">
        <Paperclip className="h-4 w-4 text-[#5E6C84] flex-shrink-0" />
        <div className="min-w-0">
          <button
            onClick={handleDownload}
            className="text-sm text-[#0052CC] hover:underline truncate block"
            title={attachment.originalFilename}
          >
            {attachment.originalFilename}
          </button>
          <p className="text-xs text-[#6B778C]">
            {formatSize(attachment.sizeBytes)} · {uploader?.name || "Unknown"} ·{" "}
            {new Date(attachment.uploadedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:bg-red-50"
            onClick={() => onDelete(attachment.id, attachment.originalFilename)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

const AttachmentsSection = ({ issue }: { issue: any }) => {
  const { user, selectedProject, attachmentsVersion } = useAuth();
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    if (!issue?.id) return;
    try {
      const res = await axiosInstance.get(`/api/issues/${issue.id}/attachments`);
      setAttachments(res.data);
    } catch (err) {
      console.error("Failed to load attachments", err);
    }
  };

  useEffect(() => {
    fetchAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue?.id, attachmentsVersion]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // allow re-selecting the same file later
    setError("");

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Unsupported file type — only PDF, PNG, JPG, and DOCX are allowed");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("File exceeds the 10MB size limit");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      await axiosInstance.post(`/api/issues/${issue.id}/attachments`, formData, {
        headers: { "Content-Type": undefined },
      });
      fetchAttachments();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"? This can't be undone.`)) return;
    try {
      await axiosInstance.delete(`/api/attachments/${attachmentId}`);
      fetchAttachments();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete attachment");
    }
  };

  return (
    <div>
      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}
      <div className="space-y-2 mb-2">
        {attachments.length === 0 ? (
          <p className="text-sm text-[#6B778C] italic">No attachments yet</p>
        ) : (
          attachments.map((attachment: any) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              canDelete={
                user?.id === attachment.uploadedBy || user?.id === selectedProject?.ownerId
              }
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.docx"
        className="hidden"
        onChange={handleFileSelect}
      />
      <button
        className="flex items-center gap-1 text-sm text-[#5E6C84] hover:text-[#0052CC]"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        <Paperclip className="h-4 w-4" />
        {isUploading ? "Uploading..." : "Attach a file"}
      </button>
      <p className="text-xs text-[#6B778C] mt-1">PDF, PNG, JPG, or DOCX — up to 10MB</p>
    </div>
  );
};

export default AttachmentsSection;