"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { getSocketClient, disconnectSocket, parseEvent, ProjectEvent } from "./socket";
import axiosInstance from "./Axiosinstance";
import { IMessage, StompSubscription } from "@stomp/stompjs";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  group?: string;
  phone?: string;
  createdAt?: any;
  emailNotificationsEnabled?: boolean;
};
export type Project = {
  id: string;
  name: string;
  key?: string;
  ownerId?: string;
  memberIds?: string[];
  description?: string;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  selectedProject: Project | null;
  setSelectedProject: (Project: Project | null) => void;
  issuesVersion: number;
  bumpIssuesVersion: () => void;
  updateUser: (user: User) => void;
  activeProjectUserIds: string[];
  notificationsVersion: number;
  attachmentsVersion: number;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [issuesVersion, setIssuesVersion] = useState(0);
  const [activeProjectUserIds, setActiveProjectUserIds] = useState<string[]>([]);
  const [notificationsVersion, setNotificationsVersion] = useState(0);
  const [attachmentsVersion, setAttachmentsVersion] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const bumpIssuesVersion = () => setIssuesVersion((v) => v + 1);
  const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

  const seenEventIds = useRef<Set<string>>(new Set());
  const issueSubscriptionRef = useRef<StompSubscription | null>(null);
  const presenceSubscriptionRef = useRef<StompSubscription | null>(null);
  const notificationSubscriptionRef = useRef<StompSubscription | null>(null);

  const selectedProjectRef = useRef<Project | null>(null);
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const lastActivity = localStorage.getItem("lastActivity");
    const isExpired =
      !!lastActivity &&
      Date.now() - Number(lastActivity) > INACTIVITY_LIMIT_MS;

    if (storedUser && !isExpired) {
      setUser(JSON.parse(storedUser));
      const storedproject = localStorage.getItem("selectedProject");
      if (storedproject) {
        setSelectedProject(JSON.parse(storedproject));
      }
    } else if (storedUser && isExpired) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("selectedProject");
      localStorage.removeItem("lastActivity");
    }

    localStorage.setItem("lastActivity", Date.now().toString());
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "user" || !event.newValue) return;
      try {
        const updated = JSON.parse(event.newValue);
        if (updated?.id === user?.id) {
          setUser(updated);
        }
      } catch {
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const recordActivity = () => {
      localStorage.setItem("lastActivity", Date.now().toString());
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, recordActivity));

    const intervalId = setInterval(() => {
      const lastActivity = Number(localStorage.getItem("lastActivity") || 0);
      if (Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
        logout();
      }
    }, 30 * 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    const client = getSocketClient(token);

    client.onConnect = () => {
      setSocketConnected(true);

      notificationSubscriptionRef.current?.unsubscribe();
      notificationSubscriptionRef.current = client.subscribe(
        "/user/queue/notifications",
        () => setNotificationsVersion((v) => v + 1),
      );
    };
    client.onDisconnect = () => setSocketConnected(false);
    client.onWebSocketClose = (event) => {
      console.warn("WebSocket closed:", event.code, event.reason);
      setSocketConnected(false);
    };

    if (!client.active) {
      client.activate();
    } else {
      setSocketConnected(client.connected);
    }

    return () => {
      issueSubscriptionRef.current?.unsubscribe();
      presenceSubscriptionRef.current?.unsubscribe();
      notificationSubscriptionRef.current?.unsubscribe();
      issueSubscriptionRef.current = null;
      presenceSubscriptionRef.current = null;
      notificationSubscriptionRef.current = null;
    };
  }, [user]);

  useEffect(() => {
    subscribeToCurrentProject();
  }, [socketConnected, selectedProject?.id]);

  const subscribeToCurrentProject = () => {
    const token = localStorage.getItem("token");
    const currentProject = selectedProjectRef.current;
    if (!user || !token || !currentProject?.id) return;

    const client = getSocketClient(token);
    if (!client.connected) return;

    issueSubscriptionRef.current?.unsubscribe();
    presenceSubscriptionRef.current?.unsubscribe();
    setActiveProjectUserIds([]);

    issueSubscriptionRef.current = client.subscribe(
      `/topic/project/${currentProject.id}`,
      (message: IMessage) => {
        const event: ProjectEvent = parseEvent(message);

        if (seenEventIds.current.has(event.eventId)) return;
        seenEventIds.current.add(event.eventId);
        if (seenEventIds.current.size > 200) {
          seenEventIds.current = new Set(Array.from(seenEventIds.current).slice(-100));
        }

        if (event.actorUserId === user.id) return;

        if (event.type === "ATTACHMENT_ADDED" || event.type === "ATTACHMENT_REMOVED") {
          setAttachmentsVersion((v) => v + 1);
          return;
        }

        bumpIssuesVersion();
      },
    );

        presenceSubscriptionRef.current = client.subscribe(
      `/topic/project/${currentProject.id}/presence`,
      (message: IMessage) => {
        try {
          const userIds: string[] = JSON.parse(message.body);
          setActiveProjectUserIds(userIds);
        } catch {
        }
      },
    );

    axiosInstance
      .get(`/api/projects/${currentProject.id}/presence`)
      .then((res: any) => setActiveProjectUserIds(res.data))
      .catch(() => {});
  };

  const login = (userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", token);
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setSelectedProject(null);
    disconnectSocket();
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("selectedProject");
    localStorage.removeItem("lastActivity");
  };

  const handleslecteproject = (project: Project | null) => {
    setSelectedProject(project);
    if (project) {
      localStorage.setItem("selectedProject", JSON.stringify(project));
    } else {
      localStorage.removeItem("selectedProject");
    }
  };
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        updateUser,
        logout,
        selectedProject,
        setSelectedProject: handleslecteproject,
        issuesVersion,
        bumpIssuesVersion,
        activeProjectUserIds,
        notificationsVersion,
        attachmentsVersion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};