Real-Time Chat Application

«Temporary Team README — Project Under Development»

A web-based real-time chat application developed as a minor project for the Web Application Development / Project Based Learning course.

The application is designed for authenticated users to communicate through private one-to-one conversations without requiring page reloads for new messages.

---

1. Project Overview

Project Title

Real-Time Chat Application

Domain

Real-Time Communication Systems

Project Type

Web Application — Minor Project

Main Objective

The objective of this project is to develop a functional and testable web application that demonstrates:

- User registration and authentication
- OTP verification
- User profiles
- Private one-to-one conversations
- Real-time messaging
- Chat history
- Online/Away/Offline presence
- User activity detection
- Secure message storage
- Conversation-level authorization
- Scheduled messages
- Basic administrative functionality

The application is intended to demonstrate the practical integration of frontend development, backend development, databases, authentication, real-time communication, and security mechanisms.

---

2. Important Project Scope

This is a normal human-to-human chat application.

The current project does NOT include:

- AI chatbot
- NLP
- LLMs
- AI-generated responses
- Group chat
- Voice calling
- Video calling
- End-to-end encryption (E2EE)
- Push/browser notification systems

These are outside the current scope unless the team later decides to add them as future enhancements.

---

3. Technology Stack

Component| Technology
Frontend| React.js
Backend| Node.js
Backend Framework| Express.js
Real-Time Communication| Socket.IO
Transport| WebSocket-based communication
Database| MongoDB
Authentication| Token/Session-based authentication
Password Security| Password hashing
Message Privacy| Server-side encryption
Version Control| Git + GitHub

Real-Time Communication Clarification

Socket.IO is the application's real-time communication layer.

It can use WebSocket transport for persistent real-time communication and provides additional features such as connection management and reconnection.

Therefore, the project should be described as:

«Real-Time Communication: Socket.IO using WebSocket-based communication»

HTTP/HTTPS will still be used for normal API requests. Real-time message delivery is handled through Socket.IO rather than ordinary HTTP requests.

---

4. System Architecture

                         React Frontend
                              │
                 ┌────────────┴────────────┐
                 │                         │
              REST API                 Socket.IO
                 │                         │
                 ▼                         ▼
          Node.js + Express        Real-Time Messaging
                 │                         │
                 └────────────┬────────────┘
                              │
                              ▼
                           MongoDB
                              │
                ┌─────────────┼─────────────┐
                │             │             │
              Users       Messages      Scheduled
                                          Messages

---

5. Main Features

5.1 User Signup

Users can create an account by providing the required registration information.

Expected functionality:

- Registration form
- Input validation
- Unique account identification
- Secure password storage
- OTP verification

Passwords must never be stored as plaintext.

---

6. OTP Verification

OTP verification will be used as part of the account verification process.

Expected behaviour

1. User enters registration details.
2. Backend generates an OTP.
3. OTP is temporarily stored.
4. OTP is sent through the selected verification channel.
5. User enters the OTP.
6. Backend validates it.
7. OTP expires after a defined period.
8. OTP cannot be reused after successful verification.

The implementation should also include reasonable protection against repeated incorrect attempts.

---

7. Login

Authenticated users can log into the application using their registered credentials.

The backend will:

1. Receive login credentials.
2. Validate the user.
3. Verify the password against the stored hash.
4. Create the required authentication session/token.
5. Return the authenticated state to the frontend.

Protected resources must require authentication.

---

8. User Profile

Users will have a profile containing information such as:

- Name
- Username/user ID
- Profile picture, if implemented
- Other basic profile information

Users should be able to edit permitted profile information.

---

9. User List

Authenticated users can view other available users and select a user to start a private conversation.

Possible functionality:

- User search
- User list
- User identification
- Current presence status

---

10. One-to-One Private Chat

The primary feature of the application is private user-to-user communication.

A conversation will contain two participants.

For example:

Alice
   │
   │ Private Conversation
   │
   ▼
Bob

A user must not be able to access another user's private conversation simply by modifying a conversation/message ID.

The backend must verify that the authenticated user is a participant in the requested conversation.

---

11. Real-Time Messaging

Messages should appear for the recipient without requiring a page refresh.

Example

Alice types:
"Hello Bob!"

        │
        ▼

React Frontend
        │
        ▼
Socket.IO
        │
        ▼
Node.js Backend
        │
        ├──────────────► MongoDB
        │
        ▼
Bob's Socket.IO Connection
        │
        ▼
Bob's React Interface

Socket.IO is responsible for real-time delivery.

MongoDB is responsible for persistent storage.

These are two separate responsibilities.

---

12. Message Persistence

Real-time delivery does not replace database storage.

When a message is sent:

Message
   │
   ├──► Real-time delivery
   │
   └──► Persistent database storage

This allows messages to remain available even if the recipient is offline.

Example

If Alice sends a message while Bob is offline:

Alice sends message
        ↓
Message stored in MongoDB
        ↓
Bob is offline
        ↓
Bob logs in later
        ↓
Chat history is requested
        ↓
Stored message is displayed

---

13. Chat History

Previous messages must be stored and retrieved from MongoDB.

The chat interface should allow users to see previous messages from their authorized conversations.

The backend must check authorization before returning private messages.

---

14. Online / Away / Offline Presence

The application will support three basic presence states:

ONLINE

The user:

- Has an active Socket.IO connection
- Has recent user activity

AWAY

The user:

- Is still connected
- Has not interacted with the application for the defined inactivity period

OFFLINE

The user:

- Has disconnected
- Does not have an active connection

Important

Simply having the website open in a browser should not automatically mean that the user is permanently shown as online.

---

15. User Activity Detection

The frontend will monitor relevant user interaction, such as:

- Mouse movement
- Keyboard interaction
- Clicks
- Touch interaction
- Page visibility
- Window focus

Activity information should not be sent to the backend for every single event.

Instead, activity updates should be throttled/debounced.

For example:

User activity
     ↓
Frontend detects activity
     ↓
Throttle activity update
     ↓
Socket.IO
     ↓
Backend updates lastActive

---

16. Presence Logic

The basic logic is:

Is the user connected?
        │
   ┌────┴────┐
   │         │
  NO        YES
   │         │
   ▼         ▼
OFFLINE   Recent activity?
              │
         ┌────┴────┐
         │         │
        YES        NO
         │         │
         ▼         ▼
       ONLINE     AWAY

The exact inactivity threshold will be finalized during implementation.

---

17. Message Privacy

The current project will implement server-side encryption of message content before database storage.

This is intended to prevent plaintext message content from being directly stored in MongoDB.

Storage flow

Plaintext Message
       ↓
Backend
       ↓
Encryption
       ↓
Ciphertext
       ↓
MongoDB

Instead of:

"Hello Bob!"

the database will contain encrypted ciphertext.

---

18. Message Retrieval

Because this is server-side encryption, the backend possesses the ability to decrypt messages when an authorized retrieval is performed.

The retrieval flow is:

MongoDB
   ↓
Encrypted message
   ↓
Backend
   ↓
Authorization check
   ↓
Decryption
   ↓
React frontend
   ↓
Plaintext displayed to authorized user

This is different from End-to-End Encryption.

---

19. E2EE Decision

End-to-End Encryption is NOT part of the current implementation.

In E2EE:

Sender Device
     ↓
Encryption
     ↓
Server
     ↓
Recipient Device
     ↓
Decryption

The server does not possess the decryption capability.

Our current system instead uses:

Client
  ↓
Backend
  ↓
Encryption
  ↓
Database

The backend can decrypt stored messages when required for an authorized operation.

E2EE may be considered as a future enhancement.

---

20. Encryption Key Management

The encryption secret/key must:

- Not be stored together with the encrypted message
- Not be committed to GitHub
- Be stored using server-side environment/configuration secrets
- Be accessible only to the backend where required

The exact encryption implementation will be finalized during development.

---

21. Authentication vs Authorization

These are separate concepts.

Authentication

Answers:

«"Who is this user?"»

Example:

Login → Verify credentials → Identify user

Authorization

Answers:

«"Is this user allowed to access this resource?"»

Example:

Alice requests Conversation X
        ↓
Backend checks participants
        ↓
Is Alice a participant?
        ↓
YES → Allow
NO  → Reject

Both are required for private chat.

---

22. Password Security

Passwords must never be stored directly in MongoDB.

Instead:

User Password
      ↓
Password Hashing
      ↓
Password Hash
      ↓
MongoDB

During login, the supplied password is verified against the stored hash.

---

23. Input Validation

Both frontend and backend validation may be used.

Frontend validation

Primarily improves user experience.

Backend validation

Provides actual server-side protection because client input cannot be trusted.

Backend validation should be applied to:

- Signup data
- Login data
- Profile updates
- Message content
- User IDs
- Conversation IDs
- Scheduled message data
- Other API inputs

---

24. Authentication for Socket Connections

A user should not be allowed to establish an unrestricted messaging socket simply by opening the application.

The Socket.IO connection should be associated with the authenticated user.

This allows the backend to know:

Socket Connection
       ↓
Authenticated User
       ↓
User ID

This identity is then used for:

- Sending messages
- Receiving messages
- Presence
- Conversation authorization
- Disconnect handling

---

25. Secure Real-Time Communication

For deployment, real-time communication should use secure transport/TLS.

Conceptually:

Development:
Socket.IO

Production:
Socket.IO
   ↓
Secure TLS connection
   ↓
WSS / secure WebSocket transport

This protects communication while it is travelling between the client and server.

---

26. Scheduled Messages

A secondary feature of the application is scheduled messaging.

A user can:

1. Select a recipient.
2. Write a message.
3. Select a future date and time.
4. Schedule the message.

Example:

Alice
  ↓
"Happy Birthday!"
  ↓
20 September, 10:00 AM
  ↓
Scheduled

The backend stores the scheduled message and processes it when its scheduled time is reached.

---

27. Scheduled Message Flow

React
  ↓
Schedule Message Request
  ↓
Node.js + Express
  ↓
Encrypt Message
  ↓
MongoDB
  ↓
Background Scheduler
  ↓
Scheduled Time Reached
  ↓
Process Message
  ↓
Socket.IO
  ↓
Recipient

If the recipient is offline, the message should remain available through persistent chat history.

Possible statuses:

PENDING
SENT
CANCELLED

---

28. Admin Dashboard

The admin dashboard is a secondary feature.

Possible functionality:

- View registered users
- Manage user accounts
- Activate/deactivate accounts
- View basic application statistics
- Perform basic administrative operations

Privacy restriction

The admin dashboard should not automatically expose the contents of users' private conversations.

Administrative functionality and private message access should remain separate.

---

29. MongoDB Structure

The initial database design is expected to contain collections such as:

users
conversations
messages
scheduledMessages

Users

Possible fields:

_id
name
username
email
passwordHash
isVerified
profileData
accountStatus
createdAt

Conversations

Possible fields:

_id
participants
createdAt
updatedAt

Messages

Possible fields:

_id
conversationId
senderId
encryptedContent
iv / nonce
authenticationTag
timestamp
status

Scheduled Messages

Possible fields:

_id
senderId
recipientId
encryptedContent
scheduledTime
status
createdAt

The exact schema may change during implementation.

---

30. Offline Message Handling

Real-time communication and persistence are independent.

If recipient is online:

Send
 ↓
Store
 ↓
Real-time delivery

If recipient is offline:

Send
 ↓
Store
 ↓
No real-time delivery
 ↓
Recipient reconnects
 ↓
History retrieved
 ↓
Message displayed

This ensures messages are not lost simply because the recipient was disconnected.

---

31. Team Work Distribution

Member 1 — Frontend & UI

Responsible for:

- React setup
- Application layout
- Signup UI
- Login UI
- OTP UI
- Profile
- User list
- Chat interface
- Chat history display
- Presence indicators
- Scheduled message UI
- Frontend API integration
- Socket.IO client integration

---

Member 2 — Backend & Authentication

Responsible for:

- Node.js setup
- Express.js setup
- REST APIs
- Signup
- Login
- OTP
- Password hashing
- Authentication
- Session/token management
- User APIs
- Profile APIs
- Input validation
- Authorization middleware
- Backend integration

---

Member 3 — Real-Time Communication & Presence

Responsible for:

- Socket.IO server
- Real-time message events
- Message delivery
- Socket authentication integration
- Connection/disconnection handling
- Online status
- Away status
- Offline status
- User activity detection
- Presence broadcasting
- Reconnection handling
- Secure real-time transport integration

---

Member 4 — Database, Security & Advanced Features

Responsible for:

- MongoDB setup
- Database schema
- Conversations
- Message persistence
- Chat history APIs
- Message encryption
- Encryption key handling
- Scheduled messages
- Background scheduler
- Admin dashboard
- Database-related testing

Member 4 should coordinate closely with Members 2 and 3 because database, authorization, encryption and real-time messaging are interconnected.

---

32. Team Integration Responsibilities

Although each member owns a module, the following must be decided collectively.

API Contract

Backend endpoints and request/response structures must be documented.

Socket Events

Frontend and backend must agree on event names and payloads.

Example:

message:send
message:receive

presence:update

user:online
user:away
user:offline

Database Schema

All members working with messages/users/conversations must follow the agreed schema.

Authentication

Authentication must work consistently across:

React
   ↓
Express API
   ↓
Socket.IO

Git Integration

Each member should work on their own branch rather than directly modifying the main branch.

Example:

main
 │
 ├── member1/frontend
 ├── member2/backend-auth
 ├── member3/realtime
 └── member4/database-security

Branches can later be merged into "main" after testing.

---

33. Core vs Secondary Features

Core Features

These form the main working chat application:

- Signup
- Login
- Authentication
- OTP verification
- User profile
- User list
- One-to-one private chat
- Real-time messaging
- Chat history
- Online/Away/Offline presence
- User activity detection
- Conversation authorization
- Password hashing
- Input validation
- Message encryption at rest

Secondary Features

These can be implemented after the core system works:

- Scheduled messages
- Admin dashboard

The application should remain functional as a basic chat application even if a secondary feature is not completed.

---

34. Features Explicitly Outside Current Scope

The following are currently excluded:

- AI chatbot
- NLP
- LLM integration
- Group conversations
- Voice calls
- Video calls
- Push notifications
- Browser notification system
- End-to-end encryption
- Complex social-media features
- Public chat rooms

These may be listed as future enhancements if required.

---

35. Testing Requirements

The team should test at least:

Authentication

- Valid signup
- Invalid signup
- Duplicate account
- Incorrect OTP
- Expired OTP
- Valid login
- Invalid login

Messaging

- Send message
- Receive message
- Message persistence
- Offline recipient
- Chat history
- Unauthorized conversation access

Presence

- User connects
- User disconnects
- User becomes inactive
- User becomes active again
- Reconnection

Security

- Passwords are not stored as plaintext
- Messages are not stored as plaintext
- Unauthorized users cannot access conversations
- Invalid input is rejected
- Authentication is required for protected operations

Scheduled Messages

- Future schedule accepted
- Past/invalid schedule rejected
- Scheduled message processed at the intended time
- Scheduled message persisted
- Offline recipient receives it through history

---

36. Non-Functional Requirements

The application should aim for:

Usability

Simple and understandable interface.

Responsiveness

Usable across common desktop and mobile browser sizes.

Reliability

Messages should not disappear simply because a recipient is temporarily offline.

Security

Authentication, authorization, password hashing, input validation, encrypted message storage and secure transport should be implemented.

Maintainability

Frontend, backend, real-time communication and database logic should remain reasonably modular.

Performance

Real-time operations should not require unnecessary page reloads or excessive requests.

---

37. Final Intended User Flow

                    START
                      │
                      ▼
                 Signup/Login
                      │
                      ▼
                OTP Verification
                      │
                      ▼
                Authenticated User
                      │
          ┌───────────┼───────────┐
          │           │           │
          ▼           ▼           ▼
       Profile     User List   Presence
                      │
                      ▼
                Select User
                      │
                      ▼
              Private Conversation
                      │
                      ▼
                 Send Message
                      │
             ┌────────┴────────┐
             │                 │
             ▼                 ▼
       Encrypt + Store    Socket.IO
             │                 │
             ▼                 ▼
          MongoDB           Recipient
             │
             ▼
         Chat History

---

38. Current Project Definition

The project can be summarized as:

«A web-based real-time chat application that allows authenticated users to communicate through private one-to-one conversations, with persistent chat history, real-time messaging, user presence detection, OTP-based verification, authorization, encrypted message storage, and optional scheduled messaging and administrative features.»

The central technical concepts demonstrated by the project are:

Frontend Development
        +
Backend Development
        +
Database Management
        +
Authentication
        +
Authorization
        +
Real-Time Communication
        +
Security
        +
Scheduled Processing

---

39. Current Status

Project Status: Planning / Development Preparation

This README is a temporary internal team document and is not intended to be the final project documentation.

As development progresses, the team can update:

- Final database schema
- API endpoints
- Socket.IO events
- Folder structure
- Environment variables
- Authentication flow
- Encryption implementation
- Final feature list
- Installation instructions
- Deployment instructions
- Screenshots
- Testing results

---

40. Team Rule

Before adding a new major feature, the team should first check whether it fits the current project scope and whether it affects the existing API, database schema, authentication, authorization, or real-time architecture.

The priority is to build a complete working one-to-one real-time chat application before adding optional features.