
# Database Module — Real-Time Chat Application

## 1. Overview

The database module provides MongoDB persistence, message encryption, conversation authorization, message history, delivery/read status updates, and scheduled-message processing.

**Technology stack**
- Node.js
- MongoDB
- Mongoose
- AES-256-GCM encryption
- dotenv for environment configuration

The module is located in the `database/` directory and is designed to integrate with the Express backend and Socket.IO real-time layer.

## 2. Project Structure

```text
database/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── models/
│   │   ├── Conversation.js
│   │   ├── Message.js
│   │   └── ScheduledMessage.js
│   ├── services/
│   │   ├── messageService.js
│   │   └── scheduledMessageService.js
│   └── utils/
│       └── encryption.js
├── test-connection.js
├── test-encryption.js
├── test-persistence.js
├── test-scheduled-messages.js
├── test-scheduled-failures.js
├── test-scheduled-recovery.js
├── .env.example
├── package.json
└── README.md
```

## 3. Setup

### Prerequisites

- Node.js and npm
- A running MongoDB server

### Install dependencies

From the `database/` directory:

```powershell
npm install
```

### Configure environment variables

Create a `.env` file inside `database/` with:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/real_time_chat
MESSAGE_ENCRYPTION_KEY=YOUR_64_CHARACTER_HEX_KEY
```

Generate a new 32-byte encryption key using:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put the generated value in your local `.env` file. Do not commit `.env`, share the key publicly, or regenerate it without planning how existing encrypted messages will be decrypted.

The `.env` file is ignored by Git. Commit `.env.example` with placeholders instead.

## 4. Database Models

### Conversation

Represents a one-to-one conversation.

- Two distinct participant IDs
- `lastMessageAt` for the latest message timestamp
- Automatic creation and update timestamps
- Participant index for membership queries

### Message

Stores individual chat messages.

- Conversation and sender ObjectIds
- Encrypted content, initialization vector, authentication tag, and key version
- Optional `clientMessageId` for retry deduplication
- Status: `sent`, `delivered`, or `read`
- Delivery and read timestamps
- Automatic creation and update timestamps
- Indexes for conversation history and message deduplication

### ScheduledMessage

Stores messages scheduled for future delivery.

- Conversation, sender, and recipient IDs
- Encrypted content and encryption metadata
- Scheduled delivery timestamp
- Status: `pending`, `processing`, `sent`, `cancelled`, or `failed`
- Attempt count, last-attempt timestamp, claim token, sent-message ID, and failure reason

Scheduled-message processing currently uses a maximum of three attempts and a five-minute processing timeout for stale-record recovery.

## 5. Service API

Import the message service from:

```javascript
const {
  saveMessage,
  getMessageHistory,
  updateMessageStatus,
  scheduleMessage,
} = require("./src/services/messageService");
```

### Save a message

```javascript
const saved = await saveMessage({
  conversationId,
  senderId,
  content,
  clientMessageId,
});
```

- Validates IDs and message content.
- Verifies that the sender belongs to the conversation.
- Encrypts the message before storing it.
- Updates the conversation's `lastMessageAt`.
- Returns the message details with plaintext content for the application.
- Reuses an existing message for a matching sender and client message ID when appropriate.

Message content must contain 1–5000 characters.

The authenticated user ID must come from the backend's authentication layer, not from an untrusted client payload.

### Retrieve message history

```javascript
const messages = await getMessageHistory({
  conversationId,
  userId,
  limit: 30,
  before,
});
```

- Verifies conversation membership.
- Decrypts messages for the authorized requester.
- Returns messages in chronological order.
- Supports pagination using the `before` timestamp.
- Accepts a history limit from 1 to 100; the default is 30.

### Update delivery/read status

```javascript
await updateMessageStatus({
  messageId,
  userId,
  status: "delivered",
});
```

For read acknowledgements:

```javascript
await updateMessageStatus({
  messageId,
  userId,
  status: "read",
});
```

Only the other participant can acknowledge a message. Valid requested statuses are `delivered` and `read`.

### Schedule a message

```javascript
const scheduled = await scheduleMessage({
  conversationId,
  senderId,
  recipientId,
  content,
  scheduledAt,
});
```

- Validates the conversation participants.
- Requires a future scheduled time.
- Encrypts content before persistence.
- Creates a scheduled record with `pending` status.

## 6. Scheduled-Message Processing

Import the processor:

```javascript
const {
  processDueScheduledMessages,
} = require("./src/services/scheduledMessageService");
```

The processor accepts a delivery callback:

```javascript
const results = await processDueScheduledMessages(
  async ({ message, recipientId }) => {
    // Integrate with the Socket.IO delivery implementation.
  },
  { limit: 25 }
);
```

The callback must be implemented by the real-time integration layer. It receives the saved message and recipient ID.

The processor:
1. Recovers stale processing records.
2. Finds due pending messages.
3. Atomically claims records using a unique claim token.
4. Decrypts scheduled content and persists the chat message.
5. Calls the delivery callback.
6. Marks successful deliveries as sent or records a retry/failure.

**Important:** The processor does not start a recurring timer or background worker by itself. The backend or a dedicated worker must invoke it periodically.

Retries and claim tokens reduce duplicate processing, but they do not guarantee exactly-once delivery across MongoDB and Socket.IO. Delivery should be idempotent, and clients should deduplicate using stable message IDs.

## 7. Encryption and Security

Messages use AES-256-GCM with a 256-bit key, a random initialization vector, and an authentication tag.

- Plaintext message content is not stored as the message body in MongoDB.
- Authorized service calls decrypt content when needed.
- The key is provided through `MESSAGE_ENCRYPTION_KEY`.
- The encryption utility uses a key-version field to identify the encryption format/version.

This is server-side encryption. Because the server holds the key and decrypts messages, this implementation is **not end-to-end encryption**.

Production deployment should also use secure key storage, access controls, encrypted network connections, and a tested key-rotation procedure.

## 8. Testing

Run the complete test suite:

```powershell
npm test
```

Run individual tests:

```powershell
npm run test:connection
npm run test:encryption
npm run test:persistence
npm run test:scheduled
npm run test:scheduled:failures
npm run test:scheduled:recovery
```

The current tests cover database connectivity, encryption/decryption, persistence, access control, retry deduplication, scheduled delivery, retry limits, and crash recovery.

Passing tests do not by themselves establish end-to-end integration or guarantee exactly-once real-time delivery.

## 9. Integration Contract

### Backend

- Initialize the database connection before using database services.
- Load environment variables before connecting.
- Supply authenticated user IDs to service calls.
- Handle validation and authorization errors.

### Real-time layer

- Persist messages before broadcasting them.
- Broadcast only after persistence succeeds.
- Validate conversation membership before room joins and delivery.
- Implement the scheduled-message delivery callback.
- Deduplicate retries and handle delivery failures.

### Frontend

- Generate stable client message IDs for retry-safe sends.
- Use returned message IDs to reconcile local and persisted messages.
- Handle delivery/read status updates consistently.

## 10. Current Limitations

- Conversation structure is designed for two participants.
- The scheduled processor requires an external invocation mechanism.
- Exactly-once real-time delivery is not guaranteed.
- Key rotation and a full end-to-end encryption protocol are not implemented.
- Integration with authentication, Express, Socket.IO, and the frontend must be validated in the combined application.

## 11. Running the Module

From the `database/` directory:

```powershell
npm install
npm test
```

Ensure MongoDB is running and the local `.env` is configured before executing the tests.
