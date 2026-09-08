import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { AlertCircle } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/Axiosinstance";
import {
  toLocalDatetimeInputValue,
  localDatetimeInputToIso,
} from "@/lib/dateUtils";

const CreateIssuemodel = ({ isOpen, onClose }: any) => {
  const { user, selectedProject, bumpIssuesVersion } = useAuth();
  const [isloading, setIsloading] = useState(false);
  const [error, setError] = useState("");
  const [teamMembers, setteamMembers] = useState([]);
    const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "TASK",
    priority: "MEDIUM",
    assigneeId: "",
    dueDate: "",
  });
  useEffect(() => {
    if (!selectedProject?.id || !isOpen) return;
    const fetchMembers = async () => {
      try {
        const res = await axiosInstance.get(
          `/api/projects/${selectedProject?.id}`,
        );
        setteamMembers(res.data.members || []);
      } catch (error) {
        console.log(error);
      }
    };
    fetchMembers();
  }, [selectedProject?.id, isOpen]);
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    setError("");
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject?.id) {
      setError("Select a project before creating an issue");
      return;
    }
    if (!user) {
      setError("You must be logged in to create an issue");
      return;
    }
    try {
      setIsloading(true);
            await axiosInstance.post("/api/issues", {
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        status: "TODO",
        projectId: selectedProject.id,
        reporterId: user.id,
        assigneeId: formData.assigneeId || null,
        dueDate: localDatetimeInputToIso(formData.dueDate),
        order: 0,
      });

      bumpIssuesVersion();
      setFormData({
        title: "",
        description: "",
        type: "TASK",
        priority: "MEDIUM",
        assigneeId: "",
        dueDate: "",
      });
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to create issue");
    } finally {
      setIsloading(false);
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex gap-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#172B4D]">
              Issue Title *
            </label>
            <Input
              type="text"
              name="title"
              placeholder="e.g., Implement user authentication"
              required
              className="h-10 border-[#DFE1E6] focus-visible:ring-[#0052CC]"
              value={formData.title}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#172B4D]">
              Description
            </label>
            <Textarea
              name="description"
              placeholder="Add a description (optional)"
              className="min-h-25 border-[#DFE1E6] focus-visible:ring-[#0052CC] resize-none"
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#172B4D]">
              Due Date
            </label>
            <Input
              type="datetime-local"
              name="dueDate"
              min={toLocalDatetimeInputValue(new Date().toISOString())}
              max={toLocalDatetimeInputValue(
                new Date(
                  new Date().setFullYear(new Date().getFullYear() + 5),
                ).toISOString(),
              )}
              className="h-10 border-[#DFE1E6] focus-visible:ring-[#0052CC]"
              value={formData.dueDate}
              onKeyDown={(e) => {
                if (e.key === "Tab") return;
                e.preventDefault();
              }}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#172B4D]">
                Type
              </label>
              <select
                name="type"
                className="w-full h-10 rounded border border-[#DFE1E6] bg-white px-3 text-sm text-[#172B4D] focus-visible:ring-2 focus-visible:ring-[#0052CC]"
                value={formData.type}
                onChange={handleChange}
              >
                <option value="TASK">Task</option>
                <option value="BUG">Bug</option>
                <option value="STORY">Story</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#172B4D]">
                Priority
              </label>
              <select
                name="priority"
                className="w-full h-10 rounded border border-[#DFE1E6] bg-white px-3 text-sm text-[#172B4D] focus-visible:ring-2 focus-visible:ring-[#0052CC]"
                value={formData.priority}
                onChange={handleChange}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#172B4D]">
                Assignee
              </label>
              <select
                name="assigneeId"
                className="w-full h-10 rounded border border-[#DFE1E6] bg-white px-3 text-sm text-[#172B4D] focus-visible:ring-2 focus-visible:ring-[#0052CC]"
                value={formData.assigneeId || ""}
                onChange={handleChange}
              >
                <option value="">Unassigned</option>
                {teamMembers.map((member: any) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isloading}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#0052CC] text-white hover:bg-[#0747A6]"
              disabled={isloading}
            >
              {isloading ? "Creating..." : "Create Issue"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateIssuemodel;
