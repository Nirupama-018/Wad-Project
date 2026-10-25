# Wad-Project Frontend

React + Vite application for the Wad-Project chat system.

## Setup

Requirements: Node.js and npm.

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run the linter:

```bash
npm run lint
```

Build for production:

```bash
npm run build
```

## Source Structure

- `src/features/auth-profile/` — authentication, profile, search and related UI (Member 1A / Member 4).
- `src/features/chat/` — chat interface, messages, conversation history, presence indicators and scheduled-message UI (Member 1B).
- `src/components/` — reusable shared UI components.
- `src/services/` — shared API, authentication and realtime service integrations.
- `src/styles/` — shared styling resources.

## Collaboration

This is one shared React application, not separate React apps for each member.

Coordinate shared routing, app-shell changes, API contracts and Socket.IO events before integrating them. Use mock data while interfaces are being finalized.

Do not assume backend endpoints, event payloads or scheduled-message operations until the responsible team member confirms their contracts.
