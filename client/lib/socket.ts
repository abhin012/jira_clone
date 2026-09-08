import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const WS_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "") +
  "/ws";

let client: Client | null = null;

export function getSocketClient(token: string): Client {
  if (client) return client;

    client = new Client({
    // Force SockJS onto the raw 'websocket' transport only. Left to itself,
    // SockJS's HTTP streaming fallbacks (xhr-streaming etc.) get buffered by
    // the platform's reverse proxy — frames the SERVER pushes (presence
    // updates, issue events) can then sit in that buffer instead of
    // arriving live, even though frames WE send (subscribe, heartbeats)
    // go out fine as separate requests. That's what produced the
    // "works after a refresh" symptom: a fresh connection sometimes landed
    // on plain 'websocket' and worked, sometimes fell back and silently
    // stopped receiving pushes. Native WebSocket is supported by every
    // browser this app targets, so there's no real fallback to give up.
    webSocketFactory: () => new SockJS(`${WS_BASE_URL}?token=${token}`, undefined, { transports: "websocket" }) as any,
    reconnectDelay: 5000, // auto-reconnect after a dropped connection
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: (str) => console.log("[STOMP]", str),
    onStompError: (frame) => {
      console.error("STOMP protocol error:", frame.headers["message"], frame.body);
    },
    onWebSocketError: (event) => {
      console.error("WebSocket connection error:", event);
    },
    onWebSocketClose: (event) => {
      console.warn("WebSocket closed:", event.code, event.reason);
    },
  });

  return client;
}

export function disconnectSocket() {
  if (client) {
    client.deactivate();
    client = null;
  }
}

export type ProjectEvent = {
  eventId: string;
  type: "ISSUE_CREATED" | "ISSUE_UPDATED" | "ISSUE_DELETED" | "ATTACHMENT_ADDED" | "ATTACHMENT_REMOVED";
  projectId: string;
  actorUserId: string | null;
  timestamp: string;
  data: any;
};

export function parseEvent(message: IMessage): ProjectEvent {
  return JSON.parse(message.body);
}