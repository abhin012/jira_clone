"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import axiosInstance from "@/lib/Axiosinstance";
import { useAuth } from "@/lib/AuthContext";

const NotificationBell = () => {
  const { user, notificationsVersion } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await axiosInstance.get("/api/notifications");
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [notificationsVersion]);

  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(fetchNotifications, 10 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

    const toggleRead = async (notification: any) => {
    try {
      const endpoint = notification.read ? "unread" : "read";
      await axiosInstance.put(`/api/notifications/${notification.id}/${endpoint}`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: !notification.read } : n)),
      );
    } catch (err) {
      console.error("Failed to toggle notification read state", err);
    }
  };

  const markAllRead = async () => {
    try {
      await axiosInstance.put("/api/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark all notifications read", err);
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded hover:bg-[#EBECF0]"
        title="Notifications"
      >
        <Bell className="h-4 w-4 text-[#42526E]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-11 left-0 z-50 w-72 rounded border border-[#DFE1E6] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm font-semibold text-[#172B4D]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                className="text-xs text-[#0052CC] hover:underline"
                onClick={markAllRead}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-sm text-[#6B778C]">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => toggleRead(n)}
                  title={n.read ? "Mark as unread" : "Mark as read"}
                  className={`block w-full border-b p-3 text-left text-sm last:border-b-0 hover:bg-[#F4F5F7] ${
                    n.read ? "text-[#6B778C]" : "text-[#172B4D] font-medium bg-[#DEEBFF]"
                  }`}
                >
                  {n.message}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;