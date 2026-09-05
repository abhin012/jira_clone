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
  const bumpIssuesVersion = () => setIssuesVersion((v) => v + 1);
  const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

  // Recently-seen realtime event ids, so a message that somehow arrives
  // twice (e.g. right around a reconnect) is only processed once.
  const seenEventIds = useRef<Set<string>>(new Set());
  const issueSubscriptionRef = useRef<StompSubscription | null>(null);
  const presenceSubscriptionRef = useRef<StompSubscription | null>(null);
  const notificationSubscriptionRef = useRef<StompSubscription | null>(null);

  // Load user from localStorage on first load — but only if their session
  // hasn't been idle for longer than the inactivity limit.
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
      // Session timed out while the app was closed — clear everything.
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("selectedProject");
      localStorage.removeItem("lastActivity");
    }

    localStorage.setItem("lastActivity", Date.now().toString());
  }, []);

  // Track activity and auto-logout after INACTIVITY_LIMIT_MS of silence.
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
    }, 30 * 1000); // check every 30 seconds

    return () => {
      events.forEach((event) => window.removeEventListener(event, recordActivity));
      clearInterval(intervalId);
    };
  }, [user]);

  // Establish the realtime connection whenever a user is logged in, and
  // tear it down on logout. Reconnection on network drops is handled
  // internally by the STOMP client (reconnectDelay in lib/socket.ts).
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    const client = getSocketClient(token);

    client.onConnect = () => {
      // Re-subscribe here (not just once at initial connect) — this
      // callback also fires again after every automatic reconnect, so
      // resubscribing inside it is what keeps updates flowing after a
      // temporary network failure without any manual intervention.
      subscribeToCurrentProject();

      // User-scoped, not project-scoped — a notification can arrive about
      // a project you aren't even currently viewing, so this subscribes
      // once per connection rather than per selected project.
      notificationSubscriptionRef.current?.unsubscribe();
      notificationSubscriptionRef.current = client.subscribe(
        "/user/queue/notifications",
        () => setNotificationsVersion((v) => v + 1),
      );
    };

    if (!client.active) {
      client.activate();
    } else {
      // Already connected from a previous render — just (re)subscribe.
      subscribeToCurrentProject();
    }

    return () => {
      issueSubscriptionRef.current?.unsubscribe();
      presenceSubscriptionRef.current?.unsubscribe();
      notificationSubscriptionRef.current?.unsubscribe();
      issueSubscriptionRef.current = null;
      presenceSubscriptionRef.current = null;
      notificationSubscriptionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Re-subscribe whenever the selected project changes.
  useEffect(() => {
    subscribeToCurrentProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id]);

  const subscribeToCurrentProject = () => {
    const token = localStorage.getItem("token");
    if (!user || !token || !selectedProject?.id) return;

    const client = getSocketClient(token);
    if (!client.connected) return;

    issueSubscriptionRef.current?.unsubscribe();
    presenceSubscriptionRef.current?.unsubscribe();
    setActiveProjectUserIds([]);

    issueSubscriptionRef.current = client.subscribe(
      `/topic/project/${selectedProject.id}`,
      (message: IMessage) => {
        const event: ProjectEvent = parseEvent(message);

        if (seenEventIds.current.has(event.eventId)) return;
        seenEventIds.current.add(event.eventId);
        if (seenEventIds.current.size > 200) {
          seenEventIds.current = new Set(Array.from(seenEventIds.current).slice(-100));
        }

        // Skip our own actions — the REST call that caused this already
        // updated our local state directly, so re-fetching here would
        // just be redundant work.
        if (event.actorUserId === user.id) return;

        // Attachment events don't affect the issue list/board at all — bump
        // a separate counter for them instead of triggering a full,
        // unrelated issues refetch.
        if (event.type === "ATTACHMENT_ADDED" || event.type === "ATTACHMENT_REMOVED") {
          setAttachmentsVersion((v) => v + 1);
          return;
        }

        bumpIssuesVersion();
      },
    );

        presenceSubscriptionRef.current = client.subscribe(
      `/topic/project/${selectedProject.id}/presence`,
      (message: IMessage) => {
        try {
          const userIds: string[] = JSON.parse(message.body);
          setActiveProjectUserIds(userIds);
        } catch {
          // ignore malformed presence payloads
        }
      },
    );

    // Fetch the current snapshot directly too — the WebSocket broadcast
    // triggered by our own subscribe can race with the broker actually
    // registering us, so a just-joined user isn't guaranteed to see who
    // was already there from the broadcast alone.
    axiosInstance
      .get(`/api/projects/${selectedProject.id}/presence`)
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