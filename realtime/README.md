# Real-Time Chat & Presence Module

**Project:** Real-Time Chat Application
**Module:** Real-Time Chat & Presence
**Team Responsibility:** Member 3
**Technology:** Node.js, Socket.IO, JavaScript, Node.js built-in test runner
**Module Location:** `realtime/`

---

## 1. Overview

This module implements the real-time communication and user-presence functionality of the Real-Time Chat Application.

Its primary responsibilities are:

- Establishing authenticated Socket.IO connections using the shared backend.
- Tracking user connections and disconnections.
- Maintaining online, away, and offline presence states.
- Automatically detecting inactivity and broadcasting away-status changes.
- Handling multiple simultaneous connections belonging to the same user.
- Throttling activity updates to reduce unnecessary server processing.
- Persisting messages through the database service and delivering them to the intended recipient.
- Supporting message-delivery and read-receipt updates through the messaging service.
- Handling reconnections and coordinating with the shared application's authentication, database, and frontend components.

The module is designed to integrate into the application's existing Socket.IO server instead of creating a separate server.

## 2. Architecture and Integration

The application is divided into modules with separate responsibilities.

| Component | Responsibility |
|---|---|
| Frontend (Member 1) | React interface, chat screens, Socket.IO client, user activity detection and rendering presence information |
| Backend and authentication (Member 2) | Express application, JWT authentication, REST API and shared HTTP/Socket.IO server |
| Real-time module (Member 3) | Socket connections, messaging events, presence tracking, inactivity detection and receipt notifications |
| Database module (Member 4) | Mongoose models, message persistence, conversation authorization, encryption, history retrieval and scheduled-message services |

### Shared-server design

The real-time module receives the existing Socket.IO server as a dependency. This allows the messaging and presence handlers to be registered on the application's shared server.

The module does not need to create a second HTTP server or listen on a separate port.

The shared backend is responsible for creating the HTTP server, configuring Socket.IO and connecting the authentication middleware. The real-time module then registers its event handlers.

### Authentication and user identity

The socket authentication middleware is expected to validate the JWT supplied by the frontend and populate `socket.userId` with the authenticated user's canonical ID.

The real-time module uses this authenticated identity rather than trusting a sender ID supplied in a message payload.

This is important because a client must not be allowed to impersonate another user simply by changing a field in its request.

The module expects an authenticated socket to have a non-empty string user ID. Connections without a valid authenticated identity are disconnected.

**Integration dependency:** The module relies on the shared backend to configure socket authentication correctly before the real-time connection handlers run.

## 3. Project Structure

The relevant module structure is:

```text
realtime/
â”œâ”€â”€ src/
â”‚   â””â”€â”€ index.js
â”œâ”€â”€ tests/
â”‚   â””â”€â”€ realtime.test.js
â”œâ”€â”€ package.json
â”œâ”€â”€ package-lock.json
â”œâ”€â”€ .gitignore
â””â”€â”€ README.md
```

### `src/index.js`

Contains the real-time handler registration and the module's main implementation, including:

- Socket connection and disconnection handling.
- User presence tracking.
- Activity validation and throttling.
- Automatic away timers.
- Messaging handler registration.
- Message persistence and delivery coordination.
- Delivery and read-receipt handling.

The module exports its handler registration functions so that the shared backend can supply the Socket.IO server and required database dependencies.

### `tests/realtime.test.js`

Contains automated tests for presence management, inactivity handling, reconnection, message validation, message delivery and receipt updates.

### `package.json`

Defines the Node.js package, its dependencies, entry point and test command.

The module uses CommonJS and the Node.js built-in test runner. Socket.IO is installed as a dependency.

### `.gitignore`

Excludes generated dependencies and local configuration files, including `node_modules/` and environment files, from version control.

## 4. Socket Connection Lifecycle

When a client connects, the module obtains the authenticated user ID from the socket.

The connection handler then:

1. Rejects connections that do not have a valid authenticated user ID.
2. Looks up the user's existing presence entry or creates one.
3. Adds the new socket ID to that user's set of active sockets.
4. Updates the user's last-activity timestamp.
5. Schedules the inactivity timer.
6. Joins the socket to the user's personal room, `user:<userId>`.
7. Sends the connecting socket a presence snapshot.
8. Broadcasts a presence update when the user's status has changed.

The personal room provides a way for the shared Socket.IO server to target a particular user across their active connections.

### Handling multiple tabs and devices

A single user may be connected from multiple browser tabs or devices. Therefore, presence is tracked per user, with a set of socket IDs associated with each user.

The user is considered connected as long as at least one socket remains active.

Disconnecting one tab does not mark the user offline if another tab or device is still connected.

When the last socket disconnects, the module clears the user's inactivity timer, removes the in-memory presence entry and broadcasts an offline update.

## 5. Presence Management

The module supports three presence states:

| State | Meaning |
|---|---|
| `online` | The user has an active connection and has recent activity |
| `away` | The user remains connected but has exceeded the inactivity threshold |
| `offline` | The user has no active connections tracked by the module |

Presence is maintained in an in-memory `Map`, keyed by authenticated user ID.

Each entry contains:

- `sockets`: a set of active socket IDs.
- `lastActiveAt`: the timestamp of the user's most recently accepted activity.
- `awayTimer`: the timer used to detect inactivity.

The current presence entry is process-local and is not persisted in MongoDB.

### Presence snapshot

On connection, the module sends a `presence:snapshot` event to the connecting socket. The payload contains a `users` array with the presence information currently tracked by the module.

### Presence update

The module broadcasts `presence:update` events when a tracked user's presence state changes, including transitions to offline and automatic transitions to away.

The presence payload includes the user ID, status and last-activity timestamp.

These events allow the frontend to update the displayed presence information without repeatedly polling the server.

## 6. Activity Detection and Throttling

The module accepts activity notifications through the `presence:activity` event.

The activity payload must indicate that the browser page is visible:

```js
{
  isVisible: true
}
```

Activity updates from hidden tabs are rejected with an `INVALID_ACTIVITY` response.

The module also verifies that the socket is still associated with an active presence entry before updating activity.

### Activity throttling

The server defines an activity throttle interval of five seconds.

If activity notifications arrive too quickly, the module acknowledges the request as successful but throttled. The timestamp is not updated for that throttled event.

This reduces unnecessary processing and prevents frequent mouse movements, keystrokes or clicks from causing continuous presence updates.

The frontend is responsible for detecting user interactions and emitting activity notifications. The server validates and throttles those notifications.

### Returning from away

When an accepted activity update arrives after the user has become away, the module updates `lastActiveAt`, resets the inactivity timer and broadcasts the transition back to online.

A newly established connection also refreshes the activity timestamp and restores online status when appropriate.

## 7. Automatic Away Detection

An important improvement made to the presence implementation was adding a timer-driven away transition.

The module defines a default inactivity threshold of **60 seconds**:

```js
const AWAY_TIMEOUT_MS = 60 * 1000;
```

When a user connects or generates accepted activity, the module schedules an inactivity timer.

If no new accepted activity arrives before the threshold expires, the timer checks the current presence entry and broadcasts an away update.

The timer also verifies that:

- The user still has an active socket.
- The presence entry has not been replaced or removed.
- The inactivity threshold has actually elapsed.

If the timer fires slightly early, it schedules another check rather than incorrectly marking the user away.

When new activity arrives, the previous timer is cleared and a new timer is scheduled.

When the last socket disconnects, the timer is cleared and the user is marked offline.

The timer is also configured with `unref()` when supported, so an inactivity timer alone does not keep a standalone Node.js process running.

### Why this implementation matters

Without an automatic timer, the server could calculate that a user is away when queried but would not necessarily broadcast the transition at the moment the threshold expires.

The timer makes the transition proactive, allowing connected clients to receive the updated presence state even when the inactive user generates no further events.

## 8. Real-Time Messaging

The messaging handlers are registered separately from the presence logic.

The message flow is designed to use the authenticated sender identity and the database module's existing persistence services.

At a high level, the flow is:

1. The client sends a message through the authenticated socket.
2. The server validates the message payload.
3. The sender identity is taken from the authenticated socket rather than trusted from the client payload.
4. The message is passed to the database service for persistence.
5. The saved message is delivered to the intended recipient through the shared Socket.IO server.
6. Delivery and read-receipt events are handled through the relevant message-service operations.

The recipient's personal room allows messages to be routed to that user's connected sockets.

### Message validation

The module rejects invalid messages before attempting to save them. For example, an invalid or empty message payload receives a failure response with the code `INVALID_PAYLOAD`.

This prevents malformed message requests from proceeding through the normal persistence and delivery flow.

### Persistence and offline recipients

Saving a message and delivering it in real time are separate operations.

A recipient does not have to be connected for the database service to save a message. However, a successful database save does not, by itself, make the message appear in an offline recipient's chat.

The recipient needs a way to retrieve the saved conversation history when they return.

Member 4's existing database service provides `getMessageHistory()`. It authorizes access to the conversation, validates the requested history limit, supports pagination using a `before` timestamp and returns decrypted messages in chronological order.

The database service exists, but the local `database/src` directory does not currently expose it through an Express history route. Therefore, end-to-end missed-message retrieval still depends on integrating that service with the shared backend and frontend.

## 9. Delivery and Read Receipts

The real-time module includes handlers for updating message status through the database service.

### Delivery receipts

When a delivery receipt is processed, the module calls the database service to update the message's delivery status and notifies the original sender.

### Read receipts

The module also supports updating read status through the database service. The relevant handler delegates the status update to the database layer rather than attempting to maintain a separate message-status database inside the real-time module.

Keeping persistence in the database service avoids duplicating responsibility between modules.

The exact end-to-end receipt behaviour still depends on the frontend emitting the corresponding events at the appropriate points in the chat interface.

## 10. Testing Strategy

The module uses Node.js's built-in testing facilities through `node:test` and assertions.

A mock Socket.IO server and mock sockets are used to test handler behaviour without requiring a running production server for every test.

The mock server records broadcast events and room-targeted events, while mock sockets simulate connections, acknowledgements, event emissions and disconnections.

Messaging tests use mock service dependencies to check that the correct calls and event handling occur.

### Test coverage

The test suite contains 12 automated tests.

| # | Test | What it verifies |
|---:|---|---|
| 1 | Registers authenticated user presence | A valid socket is added to presence tracking and receives a snapshot |
| 2 | Rejects unauthenticated socket identity | A socket without an authenticated user ID is disconnected |
| 3 | Rejects activity from a hidden browser tab | Activity with `isVisible` set to `false` is rejected |
| 4 | Marks the user offline after the last socket disconnects | The final disconnection removes presence and broadcasts offline |
| 5 | Supports multiple connections per user | Disconnecting one socket does not mark the user offline while another remains connected |
| 6 | Throttles rapid activity events | Activity arriving inside the throttle interval does not refresh the timestamp |
| 7 | Persists and delivers a message | The authenticated sender ID is used and the message is passed through persistence and delivery |
| 8 | Rejects invalid messages | An invalid message is rejected without saving it |
| 9 | Updates delivery receipts | The database service is called and the original sender is notified |
| 10 | Updates read receipts | Read status is updated through the database service |
| 11 | Automatically broadcasts away | A connected inactive user is marked away after the configured timeout |
| 12 | Restores online presence after reconnection | Presence transitions through online, offline and online |

### Test results

The latest recorded test run completed with:

```text
â„¹ tests 12
â„¹ pass 12
â„¹ fail 0
```

All 12 tests passed, including the automatic-away and reconnection tests.

These results verify the tested module logic using mocks. They do not yet establish that every integration with the shared backend, actual MongoDB instance and React frontend has been tested end to end.

## 11. How to Run the Tests

Open PowerShell and navigate to the real-time module:

```powershell
cd D:\Wad-Project\realtime
```

Run the test suite:

```powershell
npm test
```

To check the syntax of the implementation:

```powershell
node --check .\src\index.js
```

To inspect the working-tree changes from the repository root:

```powershell
cd D:\Wad-Project
git status --short
```

The real-time module's `node_modules/` directory is excluded by `.gitignore`.

## 12. Dependencies and Configuration

The module uses:

- **Node.js:** JavaScript runtime.
- **Socket.IO:** Bidirectional event-based communication.
- **Node.js `node:test`:** Automated testing.
- **Node.js assertions and event utilities:** Test validation and simulated socket behaviour.

The shared application is responsible for configuring the HTTP server, Socket.IO server, JWT verification, CORS, database connection and environment variables.

The agreed backend integration uses CommonJS, JWT access tokens and a shared backend port of `5000`. The frontend is expected to authenticate its socket connection using the access token supplied by the authentication system.

The real-time module should not independently create a competing server or introduce a separate authentication mechanism.

## 13. Security and Design Considerations

The module follows several important design principles:

- **Authenticated identity:** Message sender identity comes from the authenticated socket.
- **Conversation authorization:** History retrieval is designed to verify conversation membership in the database service.
- **Input validation:** Invalid message payloads and invalid activity events are rejected.
- **Activity throttling:** Excessively frequent activity notifications are limited.
- **Separation of responsibilities:** Message persistence and status updates are delegated to the database service.
- **Shared server integration:** Socket handlers are registered on the existing application server.
- **Connection-aware presence:** A user is not marked offline while another authenticated socket remains connected.

Presence data is currently maintained in memory. In a multi-process or multi-server deployment, a shared presence store or Socket.IO adapter would be needed to keep presence consistent across server instances.

The current module does not itself configure TLS. Public deployment must use HTTPS/WSS through the deployment environment or an appropriately configured reverse proxy.

## 14. Current Status and Remaining Integration Work

### Completed and tested

- [x] Socket connection lifecycle handling.
- [x] Authenticated user identity validation.
- [x] Per-user presence tracking.
- [x] Multiple sockets per user.
- [x] Online and offline transitions.
- [x] Automatic away transition after inactivity.
- [x] Activity validation and throttling.
- [x] Presence snapshots and broadcasts.
- [x] Message validation and persistence-service integration.
- [x] Recipient delivery handling.
- [x] Delivery and read-receipt service integration.
- [x] Reconnection behaviour.
- [x] Twelve automated tests passing.

### Remaining integration tasks

- [ ] Integrate the module into the actual shared backend server and verify its JWT socket-authentication middleware.
- [ ] Connect the React frontend's activity listeners and presence UI to the agreed socket events.
- [ ] Verify real-time messaging and receipts with two authenticated users.
- [ ] Expose the existing conversation-history service through the shared backend and fetch history when a conversation opens or reconnects.
- [ ] Verify missed-message retrieval using a real database and disconnected recipient.
- [ ] Test the complete application across two laptops or other separate clients.
- [ ] Configure and verify HTTPS/WSS for public deployment if required.

These tasks depend on the corresponding shared-backend, frontend and database integration work; they should not be interpreted as failures of the 12 module-level tests.

## 15. Summary

The Real-Time Chat & Presence module implements the server-side event handling required for a private real-time chat application. It tracks authenticated users, supports multiple simultaneous connections, broadcasts online/offline changes, automatically detects inactivity, validates messages, coordinates message persistence and handles delivery and read receipts.

The implementation was developed incrementally and verified with a focused automated test suite. The latest test run passed all 12 tests.

The next stage is end-to-end integration with the shared backend, frontend and database services, particularly to verify real message delivery and retrieval of messages received while a user was offline.
