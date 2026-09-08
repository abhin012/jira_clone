"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { X, History, Clock, ArrowLeft, Plus } from "lucide-react";
import axiosInstance from "@/lib/Axiosinstance";
import { useAuth } from "@/lib/AuthContext";

interface TimeLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  issue: any;
  teamMembers: any[];
  initialMode?: "list" | "form";
}

const TimeLogModal = ({
  isOpen,
  onClose,
  issue,
  teamMembers,
  initialMode = "list",
}: TimeLogModalProps) => {
  const { user, selectedProject } = useAuth();

  const todayIso = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<"list" | "form">(initialMode);
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(todayIso);
  const [formHours, setFormHours] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyByLogId, setHistoryByLogId] = useState<Record<string, any[]>>({});

  const canModifyLogs =
    !!user &&
    !!issue &&
    (user.id === issue.assigneeId || user.id === selectedProject?.ownerId);

  const totalLoggedHours = workLogs.reduce((sum, log) => sum + log.hours, 0);

  const fetchWorkLogs = async () => {
    if (!issue?.id) return;
    try {
      const res = await axiosInstance.get(`/api/worklogs/issue/${issue.id}`);
      setWorkLogs(res.data);
    } catch (err) {
      console.error("Failed to load work logs", err);
    }
  };

  const resetForm = () => {
    setFormDate(todayIso);
    setFormHours("");
    setFormDescription("");
  };

  useEffect(() => {
    if (!isOpen || !issue?.id) return;
    fetchWorkLogs();
    setMode(initialMode);
    setEditingLogId(null);
    setExpandedHistoryId(null);
    resetForm();
  }, [isOpen, issue?.id]);

  const userNameById = (id: string) => {
    if (id === user?.id) return "You";
    const member = teamMembers.find((m: any) => m.id === id);
    return member?.name || "Unknown";
  };

  const openAddForm = () => {
    setEditingLogId(null);
    resetForm();
    setMode("form");
  };

  const openEditForm = (log: any) => {
    setEditingLogId(log.id);
    setFormDate(log.date);
    setFormHours(String(log.hours));
    setFormDescription(log.description);
    setMode("form");
  };

  const backToList = () => {
    setMode("list");
    setEditingLogId(null);
    resetForm();
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const hoursValue = parseFloat(formHours);
    if (!formDate || isNaN(hoursValue) || !formDescription.trim()) return;

    try {
      if (editingLogId) {
        if (!confirm("Save changes to this time entry?")) return;
        await axiosInstance.put(`/api/worklogs/${editingLogId}`, {
          date: formDate,
          hours: hoursValue,
          description: formDescription,
        });
      } else {
        await axiosInstance.post("/api/worklogs", {
          issueId: issue.id,
          date: formDate,
          hours: hoursValue,
          description: formDescription,
        });
      }
      await fetchWorkLogs();
      backToList();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to save time entry");
    }
  };

  const deleteWorkLog = async (logId: string) => {
    if (!confirm("Delete this time entry? This can't be undone.")) return;
    try {
      await axiosInstance.delete(`/api/worklogs/${logId}`);
      fetchWorkLogs();
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete time entry");
    }
  };

  const toggleHistory = async (logId: string) => {
    if (expandedHistoryId === logId) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(logId);
    if (!historyByLogId[logId]) {
      try {
        const res = await axiosInstance.get(`/api/audit-logs/entity/WORK_LOG/${logId}`);
        setHistoryByLogId((prev) => ({ ...prev, [logId]: res.data }));
      } catch (err) {
        console.error("Failed to load history", err);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "form" && (
              <button
                onClick={backToList}
                className="mr-1 text-[#5E6C84] hover:text-[#172B4D]"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Clock className="h-4 w-4" />
            {mode === "list"
              ? `Time log — ${issue?.key ? `${issue.key} · ` : ""}${issue?.title}`
              : editingLogId
                ? "Edit time entry"
                : "Add time entry"}
          </DialogTitle>
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[#172B4D]">
                Total: {totalLoggedHours}h
              </div>
              {canModifyLogs && (
                <Button size="sm" className="bg-[#0052CC] text-white" onClick={openAddForm}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Time Log
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {workLogs.length === 0 ? (
                <p className="text-sm text-[#6B778C] italic">No time logged yet</p>
              ) : (
                workLogs.map((log: any) => (
                  <div key={log.id} className="rounded-md border border-[#DFE1E6] p-2">
                    <div className="flex items-start justify-between">
                      <div className="text-sm">
                        <div className="font-medium text-[#172B4D]">
                          {log.hours}h on {log.date} · {userNameById(log.userId)}
                        </div>
                        <div className="text-[#42526E]">{log.description}</div>
                        <button
                          className="text-xs text-[#0052CC] hover:underline mt-1"
                          onClick={() => toggleHistory(log.id)}
                        >
                          <History className="h-3 w-3 inline mr-1" />
                          History
                        </button>
                        {expandedHistoryId === log.id && (
                          <div className="mt-2 space-y-1 border-l-2 border-[#DFE1E6] pl-2">
                            {(historyByLogId[log.id] || []).length === 0 ? (
                              <p className="text-xs text-[#6B778C] italic">No history yet</p>
                            ) : (
                              (historyByLogId[log.id] || []).map((entry: any) => (
                                <p key={entry.id} className="text-xs text-[#6B778C]">
                                  {entry.action} by {userNameById(entry.performedBy)} —{" "}
                                  {entry.details}
                                </p>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      {canModifyLogs && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => openEditForm(log)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:bg-red-50"
                            onClick={() => deleteWorkLog(log.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitForm} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                Date
              </label>
              <input
                type="date"
                max={todayIso}
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full text-sm border rounded p-2"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                Hours
              </label>
              <input
                type="number"
                min="0.25"
                step="0.25"
                placeholder="e.g. 2.5"
                value={formHours}
                onChange={(e) => setFormHours(e.target.value)}
                required
                className="w-full text-sm border rounded p-2"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                Description
              </label>
              <textarea
                placeholder="What did you work on?"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                required
                rows={3}
                className="w-full text-sm border rounded p-2 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={backToList}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#0052CC] text-white hover:bg-[#0747A6]">
                {editingLogId ? "Save Changes" : "Log Time"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TimeLogModal;