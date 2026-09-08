# Jira Clone

A full-stack project management tool inspired by Jira — Kanban board, backlog, sprints, subtasks with dependencies, time tracking, file attachments, notifications, and live multi-user collaboration.

## Tech Stack

**Client** — Next.js 16 (React 19, App Router), TypeScript, Tailwind CSS, Radix UI, `@dnd-kit` for drag-and-drop, `@stomp/stompjs` + SockJS for realtime.

**Server** — Spring Boot 3 (Java 17), MongoDB, Spring Security + JWT, Spring WebSocket (STOMP), Brevo for transactional email.

## Features

- **Projects & boards** — Kanban board and backlog view, drag-and-drop status changes, sprints.
- **Issues** — subtasks (inherit project/sprint from parent), cross-issue dependencies with circular-dependency detection, comments, due dates.
- **Time tracking** — per-issue and per-sprint work logs with an audit trail.
- **Attachments** — type/size-restricted file uploads per issue.
- **Notifications** — in-app + email, deduplicated per event, with tiered due-date reminders (24h / 10h / 90min).
- **Realtime** — live issue updates and project presence via WebSocket, so every viewer stays in sync.
- **Auth & profile** — JWT login, email-change verification (OTP or link), password rules, account deactivation.

## Project Structure

```
client/   Next.js frontend
server/   Spring Boot backend
```

## Getting Started

### Server

```bash
cd server
cp src/main/resources/application.properties.example src/main/resources/application.properties
# fill in your MongoDB URI, JWT secret, and (optionally) Brevo API key
./mvnw spring-boot:run
```

Runs on `http://localhost:8080`.

### Client

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:3000`. Set `NEXT_PUBLIC_API_BASE_URL` in a `.env.local` file if the server isn't on `localhost:8080`.

## Deployment

The server ships with a `Dockerfile` (builds and runs the Spring Boot jar). The client deploys as a standard Next.js app (e.g. Vercel).
