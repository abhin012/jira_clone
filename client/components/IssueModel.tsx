"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import {
  Trash2,
  AlertCircle,
  Plus,
  X,
  Link2,
  Clock,
  Paperclip,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import axiosInstance from "@/lib/Axiosinstance";
import { getUserById } from "@/lib/userCache";
import { useAuth } from "@/lib/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import TimeLogModal from "./TimeLogModal";
import AttachmentsSection from "./AttachmentsSection";

const typeIcons: Record<string, string> = {
  BUG: "🐛",
  TASK: "✓",
  STORY: "📖",
};

const CommentRow = ({ comment }: any) => {
  const [author, setAuthor] = useState<any>(null);

  useEffect(() => {
    if (!comment?.authorId) return;
    getUserById(comment.authorId).then(setAuthor);
  }, [comment?.authorId]);

  return (
    <div className="rounded-md border border-[#DFE1E6] bg-[#F4F5F7] p-3">
      <div className="flex items-center gap-2 mb-1">
        <Avatar className="h-5 w-5">
          <AvatarImage src={author?.avatar} />
          <AvatarFallback className="text-[10px]">
            {author?.name?.[0] || "?"}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs font-semibold text-[#172B4D]">
          {author?.name || "Unknown"}
        </span>
        {comment.createdAt && (
          <span className="text-xs text-[#6B778C]">
            {new Date(comment.createdAt).toLocaleString()}
          </span>
        )}
      </div>
      <p className="text-sm text-[#172B4D] whitespace-pre-wrap">
        {typeof comment === "string" ? comment : comment.text}
      </p>
    </div>
  );
};

const Section = ({ title, icon, children }: any) => (
  <div className="mb-4 rounded-lg border border-[#DFE1E6] bg-white">
    <div className="border-b border-[#DFE1E6] bg-[#F4F5F7] px-4 py-2 rounded-t-lg">
      <h3 className="text-xs font-bold uppercase text-[#5E6C84] flex items-center gap-1.5">
        {icon}
        {title}
      </h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const IssueModel = ({ issue, isOpen, onClose }: any) => {
  const { user, selectedProject, bumpIssuesVersion } = useAuth();

  const [assignee, setAssignee] = useState<any>(null);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(false);
  const [localIssue, setLocalIssue] = useState<any>(issue);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  // Subtasks
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);

  // Dependencies
  const [projectIssues, setProjectIssues] = useState<any[]>([]);
  const [selectedDependencyId, setSelectedDependencyId] = useState("");

  // Time tracking — handled in a dedicated TimeLogModal, this just shows
  // a running total and buttons to open it.
  const [isTimeLogOpen, setIsTimeLogOpen] = useState(false);
  const [timeLogInitialMode, setTimeLogInitialMode] = useState<"list" | "form">(
    "list",
  );
  const [totalLoggedHours, setTotalLoggedHours] = useState(0);

  const isSubtask = !!localIssue?.parentId;

  const canModifyLogs =
    !!user &&
    !!localIssue &&
    (user.id === localIssue.assigneeId || user.id === selectedProject?.ownerId);

  useEffect(() => {
    if (!localIssue?.assigneeId) {
      setAssignee(null);
      return;
    }
    const fetchAssignee = async () => {
      try {
        const res = await axiosInstance.get(
          `/api/users/${localIssue.assigneeId}`,
        );
        setAssignee(res.data);
      } catch (err) {
        console.error("Failed to load assignee", err);
      }
    };
    fetchAssignee();
  }, [localIssue?.assigneeId]);

  useEffect(() => {
    if (!isOpen || !selectedProject?.id) return;
    const fetchMembers = async () => {
      try {
        const res = await axiosInstance.get(
          `/api/projects/${selectedProject.id}`,
        );
        setTeamMembers(res.data.members || []);
      } catch (err) {
        console.error("Failed to load team members", err);
      }
    };
    fetchMembers();
  }, [isOpen, selectedProject?.id]);

  const fetchSubtasks = async () => {
    if (!localIssue?.id) return;
    try {
      const res = await axiosInstance.get(
        `/api/issues/${localIssue.id}/subtasks`,
      );
      setSubtasks(res.data);
    } catch (err) {
      console.error("Failed to load subtasks", err);
    }
  };

  useEffect(() => {
    if (!isOpen || isSubtask) return;
    fetchSubtasks();
  }, [isOpen, localIssue?.id]);

  useEffect(() => {
    if (!isOpen || !selectedProject?.id) return;
    const fetchProjectIssues = async () => {
      try {
        const res = await axiosInstance.get(
          `/api/issues/project/${selectedProject.id}`,
        );
        setProjectIssues(res.data);
      } catch (err) {
        console.error("Failed to load project issues", err);
      }
    };
    fetchProjectIssues();
  }, [isOpen, selectedProject?.id]);

  useEffect(() => {
    if (!isOpen || !localIssue?.id) return;
    const fetchTotal = async () => {
      try {
        const res = await axiosInstance.get(
          `/api/worklogs/issue/${localIssue.id}/total`,
        );
        setTotalLoggedHours(res.data.totalHours);
      } catch (err) {
        console.error("Failed to load logged hours", err);
      }
    };
    fetchTotal();
  }, [isOpen, localIssue?.id, isTimeLogOpen]);

  const issueTitleById = new Map(
    projectIssues.map((i: any) => [i.id, i.title]),
  );

  const updateField = async (field: string, value: string) => {
    if (!localIssue) return;

    const previous = localIssue;
    const updated = { ...localIssue, [field]: value };
    setLocalIssue(updated);
    setErrorMessage("");

    try {
      setLoading(true);
      const res = await axiosInstance.put(`/api/issues/${localIssue.id}`, {
        title: updated.title,
        description: updated.description,
        type: updated.type,
        priority: updated.priority,
        status: updated.status,
        projectId: updated.projectId,
        reporterId: updated.reporterId,
        assigneeId: updated.assigneeId || null,
        sprintId: updated.sprintId ?? null,
        order: updated.order ?? 0,
        comments: updated.comments ?? [],
        updatedAt: new Date().toISOString(),
        version: localIssue.version,
        dueDate: updated.dueDate ?? null,
      });
      setLocalIssue(res.data);
      bumpIssuesVersion();
    } catch (err: any) {
      console.warn(`Failed to update ${field}`, err);
      setLocalIssue(previous);
      setErrorMessage(
        err.response?.data?.message || `Failed to update ${field}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const saveComment = async () => {
    if (!commentText.trim() || !user || !localIssue) return;

    try {
      setLoading(true);
      const updatedComments = [
        ...(localIssue.comments || []),
        {
          authorId: user.id,
          text: commentText,
          createdAt: new Date().toISOString(),
        },
      ];

      const res = await axiosInstance.put(`/api/issues/${localIssue.id}`, {
        title: localIssue.title,
        description: localIssue.description,
        type: localIssue.type,
        priority: localIssue.priority,
        status: localIssue.status,
        projectId: localIssue.projectId,
        reporterId: localIssue.reporterId,
        assigneeId: localIssue.assigneeId,
        sprintId: localIssue.sprintId ?? null,
        order: localIssue.order ?? 0,
        comments: updatedComments,
        updatedAt: new Date().toISOString(),
        version: localIssue.version,
        dueDate: localIssue.dueDate ?? null,
      });

      setLocalIssue(res.data);
      setCommentText("");
    } catch (err) {
      console.error("Failed to save comment", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!localIssue) return;
    const warning =
      subtasks.length > 0
        ? `Delete "${localIssue.title}"? This will also delete its ${subtasks.length} subtask(s). This can't be undone.`
        : `Delete "${localIssue.title}"? This can't be undone.`;
    if (!confirm(warning)) return;

    try {
      setLoading(true);
      await axiosInstance.delete(`/api/issues/${localIssue.id}`);
      bumpIssuesVersion();
      onClose();
    } catch (err) {
      console.error("Failed to delete issue", err);
    } finally {
      setLoading(false);
    }
  };

  const addSubtask = async () => {
    if (!newSubtaskTitle.trim() || !user || !localIssue) return;
    try {
      await axiosInstance.post("/api/issues", {
        title: newSubtaskTitle,
        parentId: localIssue.id,
        status: "TODO",
        priority: "MEDIUM",
        type: "TASK",
        reporterId: user.id,
      });
      setNewSubtaskTitle("");
      setIsAddingSubtask(false);
      fetchSubtasks();
      bumpIssuesVersion();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to add subtask");
    }
  };

  const toggleSubtaskDone = async (subtask: any) => {
    const newStatus = subtask.status === "DONE" ? "TODO" : "DONE";
    try {
      await axiosInstance.put(`/api/issues/${subtask.id}`, {
        title: subtask.title,
        description: subtask.description,
        type: subtask.type,
        priority: subtask.priority,
        status: newStatus,
        projectId: subtask.projectId,
        reporterId: subtask.reporterId,
        assigneeId: subtask.assigneeId,
        sprintId: subtask.sprintId,
        order: subtask.order ?? 0,
        comments: subtask.comments ?? [],
        updatedAt: new Date().toISOString(),
        version: subtask.version,
        dueDate: subtask.dueDate ?? null,
      });
      fetchSubtasks();
      bumpIssuesVersion();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update subtask");
    }
  };

  const deleteSubtask = async (subtaskId: string, title: string) => {
    if (!confirm(`Delete subtask "${title}"?`)) return;
    try {
      await axiosInstance.delete(`/api/issues/${subtaskId}`);
      fetchSubtasks();
      bumpIssuesVersion();
    } catch (err) {
      console.error("Failed to delete subtask", err);
    }
  };

  const addDependency = async () => {
    if (!selectedDependencyId || !localIssue) return;
    try {
      const res = await axiosInstance.put(
        `/api/issues/${localIssue.id}/dependencies/${selectedDependencyId}`,
      );
      setLocalIssue(res.data);
      setSelectedDependencyId("");
      // Without this, only the modal's own copy learns about the new
      // dependency — the board's issues array (which is what re-seeds this
      // modal's initial state on the next open, via the `issue` prop) stays
      // stale, so closing and reopening the same issue would show it with
      // no dependencies again.
      bumpIssuesVersion();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to add dependency");
    }
  };

  const removeDependency = async (depId: string) => {
    if (!localIssue) return;
    try {
      const res = await axiosInstance.delete(
        `/api/issues/${localIssue.id}/dependencies/${depId}`,
      );
      setLocalIssue(res.data);
      bumpIssuesVersion();
    } catch (err) {
      console.error("Failed to remove dependency", err);
    }
  };

  const availableDependencyOptions = projectIssues.filter(
    (i: any) =>
      i.id !== localIssue?.id &&
      i.status !== "DONE" &&
      !(localIssue?.dependsOn || []).includes(i.id),
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw]! max-w-200! max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 gap-0 border-none shadow-2xl">
        <DialogHeader className="p-4 border-b space-y-0">
          <DialogTitle className="text-sm font-semibold text-[#5E6C84]">
            {isSubtask && <span className="text-[#6B778C]">Subtask · </span>}
            {localIssue?.title ?? "Loading issue…"}
          </DialogTitle>
        </DialogHeader>

        {!localIssue ? (
          <div className="flex h-64 items-center justify-center text-sm text-[#6B778C]">
            Loading issue…
          </div>
        ) : (
          <div className="flex flex-col md:flex-row">
            {/* Main */}
            <div className="flex-1 min-w-0 p-8 bg-[#FAFBFC]">
              {errorMessage && (
                <div className="mb-4 flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-semibold">{localIssue.title}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:bg-red-50 hover:text-red-600 shrink-0"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>

              <Section title="Description">
                <p className="text-sm text-[#42526E]">
                  {localIssue.description || "No description"}
                </p>
              </Section>

              {!isSubtask && (
                <Section
                  title={`Subtasks (${subtasks.filter((s) => s.status === "DONE").length}/${subtasks.length})`}
                >
                  <div className="space-y-2 mb-2">
                    {subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2 rounded-md border border-[#DFE1E6] p-2"
                      >
                        <input
                          type="checkbox"
                          checked={sub.status === "DONE"}
                          onChange={() => toggleSubtaskDone(sub)}
                          className="h-4 w-4"
                        />
                        <span
                          className={`flex-1 text-sm ${
                            sub.status === "DONE"
                              ? "line-through text-[#6B778C]"
                              : ""
                          }`}
                        >
                          {sub.key ? `${sub.key} · ` : ""}
                          {sub.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:bg-red-50"
                          onClick={() => deleteSubtask(sub.id, sub.title)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {isAddingSubtask ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        addSubtask();
                      }}
                    >
                      <input
                        autoFocus
                        className="flex-1 p-1.5 border-2 border-[#0052CC] rounded text-sm"
                        placeholder="Subtask title"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        onBlur={() =>
                          !newSubtaskTitle && setIsAddingSubtask(false)
                        }
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-[#0052CC] text-white"
                      >
                        Add
                      </Button>
                    </form>
                  ) : (
                    <button
                      className="flex items-center gap-1 text-sm text-[#5E6C84] hover:text-[#0052CC]"
                      onClick={() => setIsAddingSubtask(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Add subtask
                    </button>
                  )}
                </Section>
              )}

              <Section
                title="Depends on"
                icon={<Link2 className="h-3.5 w-3.5" />}
              >
                <div className="space-y-2 mb-2">
                  {(localIssue.dependsOn || []).length === 0 ? (
                    <p className="text-sm text-[#6B778C] italic">
                      No dependencies
                    </p>
                  ) : (
                    (localIssue.dependsOn || []).map((depId: string) => (
                      <div
                        key={depId}
                        className="flex items-center justify-between rounded-md border border-[#DFE1E6] p-2 text-sm"
                      >
                        <span>{issueTitleById.get(depId) || depId}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:bg-red-50"
                          onClick={() => removeDependency(depId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <select
                    className="flex-1 text-sm border rounded p-1.5"
                    value={selectedDependencyId}
                    onChange={(e) => setSelectedDependencyId(e.target.value)}
                  >
                    <option value="">Select a task…</option>
                    {availableDependencyOptions.map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.key ? `${i.key} · ` : ""}
                        {i.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedDependencyId}
                    onClick={addDependency}
                  >
                    Add
                  </Button>
                </div>
              </Section>

              <Section
                title="Attachments"
                icon={<Paperclip className="h-3.5 w-3.5" />}
              >
                <AttachmentsSection issue={localIssue} />
              </Section>

              <Section
                title="Time Tracking"
                icon={<Clock className="h-3.5 w-3.5" />}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#172B4D]">
                    {totalLoggedHours}h logged
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTimeLogInitialMode("list");
                        setIsTimeLogOpen(true);
                      }}
                    >
                      View Time Log
                    </Button>
                    {canModifyLogs && (
                      <Button
                        size="sm"
                        className="bg-[#0052CC] text-white"
                        onClick={() => {
                          setTimeLogInitialMode("form");
                          setIsTimeLogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Time Log
                      </Button>
                    )}
                  </div>
                </div>
              </Section>

              <Section title={`Comments (${localIssue.comments?.length || 0})`}>
                <div className="space-y-4 mb-4">
                  {localIssue.comments?.length > 0 ? (
                    <div className="space-y-3">
                      {localIssue.comments.map(
                        (comment: any, index: number) => (
                          <CommentRow key={index} comment={comment} />
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-[#6B778C] italic">
                      No comments yet
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback>ME</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                    />
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        className="bg-[#0052CC] text-white"
                        disabled={!commentText || loading}
                        onClick={saveComment}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </Section>
            </div>

            {/* Sidebar */}
            <div className="w-full md:w-80 shrink-0 p-6 border-l bg-white">
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold uppercase mb-1">Status</h3>
                  <Select
                    value={localIssue.status}
                    disabled={loading}
                    onValueChange={(value) => updateField("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODO">To Do</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="DONE">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase mb-1">Type</h3>
                  <span>
                    {typeIcons[localIssue.type]} {localIssue.type}
                  </span>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase mb-1">Priority</h3>
                  <Select
                    value={localIssue.priority}
                    disabled={loading}
                    onValueChange={(value) => updateField("priority", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase mb-1">Due Date</h3>
                  <input
                    type="datetime-local"
                    value={
                      localIssue.dueDate ? localIssue.dueDate.slice(0, 16) : ""
                    }
                    min={new Date().toISOString().slice(0, 16)}
                    max={new Date(
                      new Date().setFullYear(new Date().getFullYear() + 5),
                    )
                      .toISOString()
                      .slice(0, 16)}
                    disabled={loading}
                    onChange={(e) => updateField("dueDate", e.target.value)}
                    className="w-full rounded border border-[#DFE1E6] p-2 text-sm"
                  />
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase mb-1">Assignee</h3>
                  <Select
                    value={localIssue.assigneeId || "unassigned"}
                    disabled={loading}
                    onValueChange={(value) =>
                      updateField(
                        "assigneeId",
                        value === "unassigned" ? "" : value,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {teamMembers.map((member: any) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>

      <TimeLogModal
        isOpen={isTimeLogOpen}
        onClose={() => setIsTimeLogOpen(false)}
        issue={localIssue}
        teamMembers={teamMembers}
        initialMode={timeLogInitialMode}
      />
    </Dialog>
  );
};

export default IssueModel;
