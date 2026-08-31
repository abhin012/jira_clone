"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/Axiosinstance";
import {
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import IssueModel from "@/components/IssueModel";
import SprintTimeBreakdownModal from "@/components/SprintTimeBreakdownModal";

const page = () => {
  const { selectedProject, user, issuesVersion, bumpIssuesVersion } = useAuth();

  const [issues, setIssues] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isCreatingSprint, setIsCreatingSprint] = useState(false);
  const [newSprintName, setNewSprintName] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"backlog" | "completed">("backlog");
  const [timeBreakdownSprint, setTimeBreakdownSprint] = useState<any>(null);

  /* =====================
     Fetch backlog data
  ===================== */
  const fetchData = async () => {
    if (!selectedProject?.id) return;

    try {
      setLoading(true);
      const issuesRes = await axiosInstance.get(
        `/api/issues/project/${selectedProject.id}`,
      );
      const sprintRes = await axiosInstance.get(
        `/api/sprints/project/${selectedProject.id}`,
      );
      setIssues(issuesRes.data);
      setSprints(sprintRes.data || []);
    } catch (err: any) {
      console.error("Failed to load backlog", err);
      if (err.response?.status === 403 || err.response?.status === 404) {
        // handled globally via selectedProject clearing elsewhere
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedProject?.id, issuesVersion]);

  /* =====================
     Create backlog issue
  ===================== */
  const createIssue = async () => {
    if (!newTitle.trim() || !selectedProject || !user) return;

    try {
      await axiosInstance.post("/api/issues", {
        title: newTitle,
        projectId: selectedProject.id,
        status: "TODO",
        priority: "MEDIUM",
        type: "TASK",
        reporterId: user.id,
        sprintId: null, // BACKLOG
      });

      setNewTitle("");
      setIsCreating(false);
      fetchData();
    } catch (err) {
      console.error("Failed to create issue", err);
    }
  };

  /* =====================
     Sprint actions
  ===================== */
  const createSprint = async () => {
    if (!newSprintName.trim() || !selectedProject) return;

    try {
      await axiosInstance.post("/api/sprints", {
        name: newSprintName,
        projectId: selectedProject.id,
      });
      setNewSprintName("");
      setIsCreatingSprint(false);
      fetchData();
    } catch (err) {
      console.error("Failed to create sprint", err);
    }
  };

  const startSprint = async (sprintId: string) => {
    try {
      await axiosInstance.put(`/api/sprints/${sprintId}/start`);
      fetchData();
      bumpIssuesVersion();
    } catch (err: any) {
      console.warn("Failed to start sprint", err);
      alert(err.response?.data?.message || "Failed to start sprint");
    }
  };

  const completeSprint = async (sprintId: string) => {
    if (!confirm("Complete this sprint? Unfinished issues will move back to the backlog automatically."))
      return;
    try {
      await axiosInstance.put(`/api/sprints/${sprintId}/complete`);
      fetchData();
      bumpIssuesVersion();
    } catch (err) {
      console.error("Failed to complete sprint", err);
    }
  };

  const deleteSprint = async (sprintId: string, name: string) => {
    if (!confirm(`Delete sprint "${name}"? Unfinished issues will move back to the backlog. Completed issues will remain visible under the Completed tab.`))
      return;
    try {
      await axiosInstance.delete(`/api/sprints/${sprintId}`);
      fetchData();
      bumpIssuesVersion();
    } catch (err) {
      console.error("Failed to delete sprint", err);
    }
  };

  const deleteIssue = async (issueId: string, title: string) => {
    if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
    try {
      await axiosInstance.delete(`/api/issues/${issueId}`);
      bumpIssuesVersion();
    } catch (err) {
      console.error("Failed to delete issue", err);
    }
  };

  const moveIssue = async (issue: any, sprintId: string | null) => {
    try {
            await axiosInstance.put(`/api/issues/${issue.id}`, {
        title: issue.title,
        description: issue.description,
        type: issue.type,
        priority: issue.priority,
        status: issue.status,
        projectId: issue.projectId,
        reporterId: issue.reporterId,
        assigneeId: issue.assigneeId || null,
        sprintId: sprintId,
        order: issue.order ?? 0,
        comments: issue.comments ?? [],
        updatedAt: new Date().toISOString(),
        version: issue.version,
        dueDate: issue.dueDate ?? null,
      });
      bumpIssuesVersion();
    } catch (err: any) {
      if (err.response?.status === 409) fetchData();
      console.error("Failed to move issue", err);
    }
  };

  const sprintById = new Map(sprints.map((s) => [s.id, s]));
  const backlogIssues = issues.filter((i) => !i.sprintId && i.status !== "DONE");
  const movableSprints = sprints.filter((s) => s.status !== "COMPLETED");
  const completedIssues = issues.filter((i) => i.status === "DONE");

  // Group completed issues by sprint, same shape as the Backlog tab's
  // sprint sections — including a fallback group for issues whose sprint
  // was later deleted, and one for issues finished without ever being in
  // a sprint at all.
  const completedGroupMap = new Map<string, { key: string; label: string; issues: any[] }>();
  for (const issue of completedIssues) {
    let key: string;
    let label: string;

    if (!issue.sprintId) {
      key = "__no_sprint__";
      label = "Completed (no sprint)";
    } else {
      const sprint = sprintById.get(issue.sprintId);
      if (sprint) {
        key = sprint.id;
        label = sprint.name;
      } else {
        key = "__deleted_sprint__";
        label = "Completed (sprint deleted)";
      }
    }

    if (!completedGroupMap.has(key)) {
      completedGroupMap.set(key, { key, label, issues: [] });
    }
    completedGroupMap.get(key)!.issues.push(issue);
  }
  const completedGroups = Array.from(completedGroupMap.values());

  return (
    <div className="flex h-full flex-col p-6 overflow-hidden">
      {/* Breadcrumb */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-[#5E6C84]">
          <span>Projects</span>
          <ChevronRight className="h-4 w-4" />
          <span>{selectedProject?.name}</span>
          <ChevronRight className="h-4 w-4" />
          <span>Backlog</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              className={`px-3 py-1.5 text-sm font-semibold rounded ${
                activeTab === "backlog"
                  ? "bg-[#0052CC] text-white"
                  : "text-[#5E6C84] hover:bg-[#F4F5F7]"
              }`}
              onClick={() => setActiveTab("backlog")}
            >
              Backlog
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-semibold rounded ${
                activeTab === "completed"
                  ? "bg-[#0052CC] text-white"
                  : "text-[#5E6C84] hover:bg-[#F4F5F7]"
              }`}
              onClick={() => setActiveTab("completed")}
            >
              Completed ({completedIssues.length})
            </button>
          </div>
          {activeTab === "backlog" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingSprint(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Sprint
            </Button>
          )}
        </div>

        {activeTab === "backlog" && isCreatingSprint && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              createSprint();
            }}
          >
            <input
              autoFocus
              placeholder="Sprint name"
              className="flex-1 p-2 border-2 border-[#0052CC] rounded text-sm"
              value={newSprintName}
              onChange={(e) => setNewSprintName(e.target.value)}
              onBlur={() => !newSprintName && setIsCreatingSprint(false)}
            />
            <Button type="submit" size="sm" className="bg-[#0052CC] text-white">
              Create
            </Button>
          </form>
        )}
      </div>

      {activeTab === "backlog" ? (
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {loading && issues.length === 0 && sprints.length === 0 && (
            <div className="p-6 text-center text-sm text-[#6B778C]">
              Loading backlog…
            </div>
          )}

          {/* Sprint Sections */}
          {sprints.map((sprint) => {
            const sprintIssues = issues.filter((i) => i.sprintId === sprint.id);
            return (
              <SprintSection
                key={sprint.id}
                sprint={sprint}
                issues={sprintIssues}
                movableSprints={movableSprints}
                onStart={() => startSprint(sprint.id)}
                onComplete={() => completeSprint(sprint.id)}
                onDelete={() => deleteSprint(sprint.id, sprint.name)}
                onIssueClick={setSelectedIssue}
                onMoveIssue={moveIssue}
                onViewTimeBreakdown={() => setTimeBreakdownSprint(sprint)}
              />
            );
          })}

          {/* Backlog Section */}
          <section>
            <SectionHeader title="Backlog" count={backlogIssues.length} />

            <div className="border border-t-0 rounded-b-md divide-y">
              {backlogIssues.map((issue) => (
                <BacklogItem
                  key={issue.id}
                  issue={issue}
                  sprintName={null}
                  locked={false}
                  movableSprints={movableSprints}
                  onClick={() => setSelectedIssue(issue)}
                  onMoveIssue={moveIssue}
                />
              ))}

              {isCreating ? (
                <form
                  className="p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createIssue();
                  }}
                >
                  <input
                    autoFocus
                    className="w-full p-1 border-2 border-[#0052CC] rounded text-sm"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onBlur={() => !newTitle && setIsCreating(false)}
                  />
                </form>
              ) : (
                <CreateIssueRow onClick={() => setIsCreating(true)} />
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {completedIssues.length === 0 ? (
            <p className="p-6 text-center text-sm text-[#6B778C]">
              No completed issues yet.
            </p>
          ) : (
            completedGroups.map((group) => (
              <section key={group.key}>
                <SectionHeader title={group.label} count={group.issues.length} />
                <div className="border border-t-0 rounded-b-md divide-y">
                  {group.issues.map((issue: any) => (
                    <div
                      key={issue.id}
                      className="flex items-center justify-between p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-4 w-4 rounded bg-green-500 flex-shrink-0" />
                        <span className="text-sm text-[#5E6C84] flex-shrink-0">
                          {issue.key}
                        </span>
                        <span className="truncate">{issue.title}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => deleteIssue(issue.id, issue.title)}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      <IssueModel
        key={selectedIssue?.id}
        issue={selectedIssue}
        isOpen={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />

      <SprintTimeBreakdownModal
        isOpen={!!timeBreakdownSprint}
        onClose={() => setTimeBreakdownSprint(null)}
        sprint={timeBreakdownSprint}
      />
    </div>
  );
};

const SectionHeader = ({ title, count, right }: any) => (
  <div className="flex items-center justify-between bg-[#F4F5F7] p-3 rounded-t-md border-b">
    <div className="flex items-center gap-2">
      <ChevronDown className="h-4 w-4" />
      <span className="font-semibold">{title}</span>
      <span className="text-xs ml-2 text-[#5E6C84]">{count} issues</span>
    </div>
    {right}
  </div>
);

const statusBadge: Record<string, string> = {
  PLANNED: "bg-[#EBECF0] text-[#42526E]",
  ACTIVE: "bg-green-100 text-green-800",
  COMPLETED: "bg-blue-100 text-blue-800",
};

const SprintSection = ({
  sprint,
  issues,
  movableSprints,
  onStart,
  onComplete,
  onDelete,
  onIssueClick,
  onMoveIssue,
  onViewTimeBreakdown,
}: any) => {
  // Only show non-DONE issues here — finished issues live in the Completed tab.
  const visibleIssues = issues.filter((i: any) => i.status !== "DONE");
  const [totalHours, setTotalHours] = useState<number | null>(null);

  useEffect(() => {
    const fetchTotal = async () => {
      try {
        const res = await axiosInstance.get(`/api/worklogs/sprint/${sprint.id}/total`);
        setTotalHours(res.data.totalHours);
      } catch (err) {
        console.error("Failed to load sprint total hours", err);
      }
    };
    fetchTotal();
  }, [sprint.id]);

  return (
    <section>
      <SectionHeader
        title={sprint.name}
        count={visibleIssues.length}
        right={
          <div className="flex items-center gap-2">
            {totalHours !== null && totalHours > 0 && (
              <button
                className="text-xs text-[#0052CC] hover:underline"
                onClick={onViewTimeBreakdown}
              >
                {totalHours}h logged
              </button>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded font-semibold ${
                statusBadge[sprint.status] || "bg-gray-100 text-gray-700"
              }`}
            >
              {sprint.status}
            </span>
            {sprint.status === "PLANNED" && (
              <Button size="sm" className="bg-[#0052CC] text-white" onClick={onStart}>
                Start Sprint
              </Button>
            )}
            {sprint.status === "ACTIVE" && (
              <Button size="sm" variant="outline" onClick={onComplete}>
                Complete Sprint
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:bg-red-50 hover:text-red-600"
              onClick={onDelete}
            >
              Delete
            </Button>
          </div>
        }
      />
      <div className="border border-t-0 rounded-b-md divide-y">
        {visibleIssues.length === 0 ? (
          <p className="p-4 text-sm text-[#6B778C] italic">
            No open issues in this sprint — move some from the Backlog below.
          </p>
        ) : (
          visibleIssues.map((issue: any) => (
            <BacklogItem
              key={issue.id}
              issue={issue}
              sprintName={sprint.name}
              locked={sprint.status === "COMPLETED"}
              movableSprints={movableSprints}
              onClick={() => onIssueClick(issue)}
              onMoveIssue={onMoveIssue}
            />
          ))
        )}
      </div>
    </section>
  );
};

const CreateIssueRow = ({ onClick }: any) => (
  <div className="p-2 hover:bg-[#F4F5F7] cursor-pointer" onClick={onClick}>
    <div className="flex items-center gap-2 text-sm text-[#5E6C84]">
      <Plus className="h-4 w-4" />
      Create issue
    </div>
  </div>
);

const BacklogItem = ({
  issue,
  sprintName,
  locked,
  movableSprints,
  onClick,
  onMoveIssue,
}: any) => {
  const [assignee, setAssignee] = useState<any>(null);

  useEffect(() => {
    if (!issue?.assigneeId) {
      setAssignee(null);
      return;
    }
    const fetchAssignee = async () => {
      try {
        const res = await axiosInstance.get(`/api/users/${issue.assigneeId}`);
        setAssignee(res.data);
      } catch (err) {
        console.error("Failed to load assignee", err);
      }
    };
    fetchAssignee();
  }, [issue?.assigneeId]);

  const priorityMap = {
    HIGH: "text-red-500",
    MEDIUM: "text-orange-500",
    LOW: "text-blue-500",
  };

  const priorityColor =
    priorityMap[issue.priority as keyof typeof priorityMap] || "text-gray-500";

  return (
    <div className="flex items-center justify-between p-3 hover:bg-[#F4F5F7] group">
      <div
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        onClick={onClick}
      >
        <div className="h-4 w-4 rounded bg-blue-500 flex-shrink-0" />
        <span className="text-sm text-[#5E6C84] flex-shrink-0">
          {issue.key}
        </span>
        <span className="truncate">{issue.title}</span>
      </div>

      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100">
        {issue.dueDate && (
          <span
            className={`text-xs ${
              new Date(issue.dueDate).getTime() < Date.now()
                ? "text-red-600 font-semibold"
                : "text-[#6B778C]"
            }`}
          >
            {new Date(issue.dueDate).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        <span className={`text-xs font-bold ${priorityColor}`}>
          {issue.priority}
        </span>
        <Avatar className="h-6 w-6">
          <AvatarImage src={assignee?.avatar} />
          <AvatarFallback>{assignee?.name?.[0] || "U"}</AvatarFallback>
        </Avatar>
        {locked ? (
          <span className="text-xs text-[#6B778C] italic">{sprintName}</span>
        ) : (
          <select
            className="text-xs border rounded p-1"
            value={issue.sprintId || ""}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onMoveIssue(issue, e.target.value || null)}
          >
            <option value="">Backlog</option>
            {movableSprints.map((sprint: any) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};

export default page;