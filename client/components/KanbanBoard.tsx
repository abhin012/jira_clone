"use client";

import {
  closestCorners,
  defaultDropAnimationSideEffects,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import KanbanColumn from "./KanbanColumn";
import { createPortal } from "react-dom";
import KanbanCard, { KanbanCardOverlay } from "./KanbanCard";
import IssueModel from "./IssueModel";
import axiosInstance from "@/lib/Axiosinstance";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";

const STATUS_COLUMNS = [
  { id: "TODO", title: "To Do" },
  { id: "IN_PROGRESS", title: "In Progress" },
  { id: "DONE", title: "Done" },
];

const KanbanBoard = () => {
  const { selectedProject, setSelectedProject, issuesVersion } = useAuth();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("search")?.toLowerCase() || "";

  const [issues, setIssues] = useState<any[]>([]);
  const [activeSprint, setActiveSprint] = useState<any | null>(null);
  const [activeIssue, setActiveIssue] = useState<any | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const fetchIssues = async () => {
    if (!selectedProject?.id) return;

    try {
      setLoading(true);
      const [issuesRes, sprintsRes] = await Promise.all([
        axiosInstance.get(`/api/issues/project/${selectedProject.id}`),
        axiosInstance.get(`/api/sprints/project/${selectedProject.id}`),
      ]);
      setIssues(issuesRes.data);
      const active = (sprintsRes.data || []).find(
        (s: any) => s.status === "ACTIVE",
      );
      setActiveSprint(active || null);
    } catch (err: any) {
      console.error("Failed to load issues", err);
      if (err.response?.status === 403 || err.response?.status === 404) {
        setSelectedProject(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [selectedProject?.id, issuesVersion]);

  useEffect(() => {
    if (!selectedIssue) return;
    const fresh = issues.find((i) => i.id === selectedIssue.id);
    if (fresh && fresh !== selectedIssue) {
      setSelectedIssue(fresh);
    }
  }, [issues]);

  const onDragStart = (event: DragStartEvent) => {
    const issue = issues.find((i) => i.id === event.active.id);
    setActiveIssue(issue || null);
  };

 const resolveColumnId = (overId: string): string | null => {
    if (STATUS_COLUMNS.some((c) => c.id === overId)) return overId;
    const overIssue = issues.find((i) => i.id === overId);
    return overIssue ? overIssue.status : null;
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveIssue(null);

    const { active, over } = event;
    if (!over) return;

    const issueId = active.id as string;
    const newStatus = resolveColumnId(over.id as string);
    if (!newStatus) return;

    const issue = issues.find((i) => i.id === issueId);
    if (!issue || issue.status === newStatus) return;

    const updatedIssue = {
      ...issue,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

        try {
      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? updatedIssue : i))
      );

      const res = await axiosInstance.put(`/api/issues/${issueId}`, {
        title: updatedIssue.title,
        description: updatedIssue.description,
        type: updatedIssue.type,
        priority: updatedIssue.priority,
        status: updatedIssue.status,
        projectId: updatedIssue.projectId,
        reporterId: updatedIssue.reporterId,
        assigneeId: updatedIssue.assigneeId,
        sprintId: updatedIssue.sprintId ?? null,
        order: updatedIssue.order ?? 0,
        comments: updatedIssue.comments ?? [],
        updatedAt: updatedIssue.updatedAt,
        version: issue.version,
        dueDate: updatedIssue.dueDate ?? null,
      });

      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? res.data : i))
      );
    } catch (err: any) {
      console.warn("Failed to update issue", err);
      if (err.response?.status === 409) {
        fetchIssues();
      } else {
        setIssues((prev) => prev.map((i) => (i.id === issueId ? issue : i)));
        alert(err.response?.data?.message || "Failed to move issue");
      }
    }
  };

  if (!selectedProject) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#6B778C]">
        Select a project to view the board
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {loading ? (
        <div className="flex h-full items-center justify-center text-sm text-[#6B778C]">
          Loading board…
        </div>
      ) : !activeSprint ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[#6B778C]">
          <p>No active sprint for this project.</p>
          <Link
            href="/backlog"
            className="text-[#0052CC] hover:underline font-medium"
          >
            Go to Backlog to start one
          </Link>
        </div>
      ) : (
        <div className="flex h-full gap-4 pb-4">
          {STATUS_COLUMNS.map((column) => {
            const columnIssues = issues
              .filter((i) => i.sprintId === activeSprint.id)
              .filter((i) => i.status === column.id)
              .filter(
                (issue) =>
                  issue?.title?.toLowerCase().includes(searchQuery) ||
                  issue?.key?.toLowerCase().includes(searchQuery)
              )
              .sort((a, b) => a.order - b.order);

            return (
              <KanbanColumn
                key={column.id}
                column={column}
                issues={columnIssues}
                onIssueClick={setSelectedIssue}
              />
            );
          })}
        </div>
      )}

      {}
      <IssueModel
        key={selectedIssue?.id}
        issue={selectedIssue}
        isOpen={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />

      {}
      {isMounted &&
        !loading &&
        createPortal(
          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: { active: { opacity: "0.5" } },
              }),
            }}
          >
            {activeIssue ? (
              <KanbanCardOverlay issue={activeIssue} />
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
};

export default KanbanBoard;
