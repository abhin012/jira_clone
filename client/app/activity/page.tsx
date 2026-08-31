"use client";

import React, { useEffect, useState } from "react";
import { ChevronRight, History } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/Axiosinstance";

const actionColors: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

const page = () => {
  const { selectedProject } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!selectedProject?.id) return;
    const fetchActivity = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(
          `/api/audit-logs/project/${selectedProject.id}`,
        );
        setEntries(res.data);

        const uniqueUserIds: string[] = Array.from(
          new Set(res.data.map((e: any) => e.performedBy).filter(Boolean)),
        );
        const names: Record<string, string> = {};
        await Promise.all(
          uniqueUserIds.map(async (id) => {
            try {
              const userRes = await axiosInstance.get(`/api/users/${id}`);
              names[id] = userRes.data.name;
            } catch {
              names[id] = "Unknown";
            }
          }),
        );
        setUserNames(names);
      } catch (err) {
        console.error("Failed to load activity", err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [selectedProject?.id]);

  return (
    <div className="flex h-full flex-col p-6 overflow-hidden">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-[#5E6C84]">
          <span>Projects</span>
          <ChevronRight className="h-4 w-4" />
          <span>{selectedProject?.name}</span>
          <ChevronRight className="h-4 w-4" />
          <span>Activity</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#172B4D] flex items-center gap-2">
          <History className="h-5 w-5" />
          Activity Log
        </h1>
        <p className="text-sm text-[#6B778C]">
          A complete audit trail of time-tracking changes across this project —
          including entries that have since been deleted.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-[#6B778C]">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-[#6B778C] italic">No activity recorded yet.</p>
        ) : (
          <div className="divide-y border rounded-md bg-white">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 p-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${
                    actionColors[entry.action] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {entry.action}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-[#0052CC] bg-[#DEEBFF] px-1.5 py-0.5 rounded">
                      {entry.issueKey || "—"}
                    </span>
                    <span className="text-sm font-semibold text-[#172B4D] truncate">
                      {entry.issueTitle}
                    </span>
                  </div>
                  <p className="text-sm text-[#42526E]">
                    <span className="font-semibold text-[#172B4D]">
                      {userNames[entry.performedBy] || "Unknown"}
                    </span>{" "}
                    {entry.details}
                  </p>
                  <p className="text-xs text-[#6B778C] mt-0.5">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default page;