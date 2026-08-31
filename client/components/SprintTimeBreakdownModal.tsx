"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Clock } from "lucide-react";
import axiosInstance from "@/lib/Axiosinstance";

interface SprintTimeBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  sprint: any;
}

const SprintTimeBreakdownModal = ({
  isOpen,
  onClose,
  sprint,
}: SprintTimeBreakdownModalProps) => {
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !sprint?.id) return;
    const fetchBreakdown = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(
          `/api/worklogs/sprint/${sprint.id}/breakdown`,
        );
        setBreakdown(res.data);
      } catch (err) {
        console.error("Failed to load sprint time breakdown", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBreakdown();
  }, [isOpen, sprint?.id]);

  const total = breakdown.reduce((sum, b) => sum + b.totalHours, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Time breakdown — {sprint?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-[#172B4D]">
            Total: {total}h across {breakdown.length} task{breakdown.length === 1 ? "" : "s"}
          </div>

          {loading ? (
            <p className="text-sm text-[#6B778C]">Loading…</p>
          ) : breakdown.length === 0 ? (
            <p className="text-sm text-[#6B778C] italic">No time logged in this sprint yet</p>
          ) : (
            <div className="divide-y border rounded-md">
              {breakdown
                .sort((a, b) => b.totalHours - a.totalHours)
                .map((entry) => (
                  <div
                    key={entry.issueId}
                    className="flex items-center justify-between p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <span className="text-[#5E6C84] mr-2">{entry.issueKey}</span>
                      <span className="truncate">{entry.issueTitle}</span>
                      {entry.status === "DONE" && (
                        <span className="ml-2 text-xs text-green-700">(Done)</span>
                      )}
                    </div>
                    <span className="font-semibold flex-shrink-0">
                      {entry.totalHours}h
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SprintTimeBreakdownModal;