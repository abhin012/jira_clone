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
  // Tracks the STOMP connection itself as React state (rather than only
  // ever consulting client.connected ad hoc) so a dedicated effect below can
  // react to "just became connected" the same way it reacts to "project
  // changed" — see that effect for why the two need to be driven by the
  // same mechanism.
  const [socketConnected, setSocketConnected] = useState(false);
  const bumpIssuesVersion = () => setIssuesVersion((v) => v + 1);
  const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

  // Recently-seen realtime event ids, so a message that somehow arrives
  // twice (e.g. right around a reconnect) is only processed once.
  const seenEventIds = useRef<Set<string>>(new Set());
  const issueSubscriptionRef = useRef<StompSubscription | null>(null);
  const presenceSubscriptionRef = useRef<StompSubscription | null>(null);
  const notificationSubscriptionRef = useRef<StompSubscription | null>(null);

  // Mirrors `selectedProject` for subscribeToCurrentProject() to read instead
  // of the state variable directly. `client.onConnect` below is assigned
  // once inside the [user] effect, so the closure it captures is frozen at
  // whatever `selectedProject` was on THAT render — if the project gets
  // selected/changed afterward (e.g. a fresh login picking a project only
  // after the socket already connected), that stale closure would keep
  // silently no-op'ing forever, since [user] never changes again to
  // refresh it. Reading through a ref sidesteps that: every call sees the
  // current project no matter how old the closure holding the call is.
  const selectedProjectRef = useRef<Project | null>(null);
  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

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

  // Pick up profile changes written to localStorage by ANOTHER tab of this
  // same origin — e.g. the /confirm-email page patching the stored email
  // after the user opens their verification link in a new tab. The
  // browser's `storage` event only fires in tabs OTHER than the one that
  // made the write, which is exactly the case this closes: without it, a
  // profile tab left open during the email-change flow would keep showing
  // the old email until manually refreshed.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "user" || !event.newValue) return;
      try {
        const updated = JSON.parse(event.newValue);
        if (updated?.id === user?.id) {
          setUser(updated);
        }
      } catch {
        // ignore malformed storage payloads
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user?.id]);

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
      // Just flip the flag — do NOT call subscribeToCurrentProject() here
      // directly. It used to be called from this callback, but onConnect
      // can fire before selectedProject has been restored (from
      // localStorage, or picked by the user) into React state, since the
      // WS handshake and React's render/effect cycle are two independent
      // async processes with no guaranteed ordering. When that race lost,
      // subscribeToCurrentProject() would bail out on its
      // !currentProject?.id guard, and — because this callback only fires
      // ONCE per connection — nothing ever retried, permanently leaving
      // that session with no project/presence subscription. Routing both
      // "socket connected" and "project selected" through the same
      // dependency-array effect below (rather than one being an imperative
      // callback and the other a separate effect) means whichever one
      // resolves last is the one that ends up triggering the subscribe.
      setSocketConnected(true);

      // User-scoped, not project-scoped — a notification can arrive about
      // a project you aren't even currently viewing, so this subscribes
      // once per connection rather than per selected project.
      notificationSubscriptionRef.current?.unsubscribe();
      notificationSubscriptionRef.current = client.subscribe(
        "/user/queue/notifications",
        () => setNotificationsVersion((v) => v + 1),
      );
    };
    client.onDisconnect = () => setSocketConnected(false);
    // onDisconnect only fires for a clean, negotiated STOMP disconnect — an
    // abrupt drop (network loss, server restart) instead fires this, so both
    // are needed to reliably flip socketConnected back to false. That flip
    // matters even though the library's own reconnectDelay handles the
    // reconnect itself: onConnect firing again after a silent reconnect
    // wouldn't otherwise change socketConnected (already true), so the
    // resubscribe effect below would never re-run.
    client.onWebSocketClose = (event) => {
      console.warn("WebSocket closed:", event.code, event.reason);
      setSocketConnected(false);
    };

    if (!client.active) {
      client.activate();
    } else {
      // Already connected from a previous render — the onConnect callback
      // above won't fire again for an already-open connection, so sync the
      // flag directly instead of waiting for an event that isn't coming.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // The single source of truth for (re)subscribing to the current project's
  // issue + presence topics. Fires whenever EITHER half of the "can we
  // subscribe now?" condition changes — the socket becoming connected, or
  // the selected project changing — so whichever one becomes true last is
  // guaranteed to trigger it, instead of each being wired to its own
  // one-shot trigger that can fire before the other half is ready.
  useEffect(() => {
    subscribeToCurrentProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      `/topic/project/${currentProject.id}/presence`,
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