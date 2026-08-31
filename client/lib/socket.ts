import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const WS_BASE_URL =
  (process.env.API_BASE_URL || "http://localhost:8080").replace(/\/$/, "") +
  "/ws";

let client: Client | null = null;

export function getSocketClient(token: string): Client {
  if (client) return client;

    client = new Client({
    webSocketFactory: () => new SockJS(`${WS_BASE_URL}?token=${token}`) as any,
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
  actorUserId: string;
  timestamp: string;
  data: any;
};

export function parseEvent(message: IMessage): ProjectEvent {
  return JSON.parse(message.body);
}