# Nexa Whispers

> Private conversations. Seamlessly connected.

Nexa Whispers is a premium, Signal-inspired private messaging application. It delivers a minimal, polished, and secure communication experience, combining a REST API server, real-time WebSocket messaging synchronization, and a lightweight React SPA.

---

## Technical Stack & Deviation Note

> [!NOTE]
> **Implementation Architecture Deviation**: The original assignment specifications requested Next.js + TypeScript (Frontend) and Python FastAPI/Django (Backend). 
>
> To ensure optimal understanding, complete implementation control, and clear presentation during the technical interview, this project intentionally deviates from the requested stack, utilizing:
> * **Frontend**: React.js (JavaScript, Vite, React Router, CSS Design Tokens, Sockets, Axios, Lucide)
> * **Backend**: Node.js (Express, Socket.IO, JWT, bcryptjs, cookie-parser, multer)
> * **Database**: SQLite (managed with promise-based driver wrapper)

---

## Features

### P0 — Core Functionality
* **Signal-Inspired Minimal UI**: Polished sidebar list, header metadata, active typing alerts, and custom message bubble shapes.
* **Authentication Gate**: User registration, developer-mode OTP verification, secure bcrypt password hashing, and cookie-based JWT sessions.
* **Bi-directional Contacts**: Look up registered user profiles by username and build mutual contact lists automatically.
* **Dynamic Direct Chats**: Check for existing conversation instances between participants, preventing duplicate direct chat records.
* **Atomic Group Chats**: Create conversation circles, invite members, designate group creators as administrators, and manage memberships.
* **Truthful Status Receipts**: Real-time Socket.IO synchronization mapping delivery and read receipts (`sending` $\rightarrow$ `sent` ✓ $\rightarrow$ `delivered` ✓✓ $\rightarrow$ `read` purple ✓✓).
* **Typing & Presence Indicators**: Instantly broadcast when a user is typing in a conversation or toggles their online state.

### P1 — UI Polish & Interactions
* **Nested Thread Replies**: Quote sender name and snippets. Click quoted blocks to smoothly scroll the parent message back into view with a visual highlight.
* **Emoji Reactions picker**: Add or replace reactions underneath message bubbles in real-time.
* **Smart scrolling pane**: Automatically scroll down on new messages only if the user is near the bottom, displaying a floating "New Messages" down-arrow button otherwise.
* **Date Separators**: Inject date headers dynamically (e.g. "Yesterday") when message timestamps change.
* **Premium Dark Mode**: Seamless toggle persisting user theme preference in LocalStorage.
* **Responsive Collapsing**: Responsive grid collapsing sidebar list on mobile when a chat is actively selected, with back-arrow header controls.

### P2 — Advanced Extras
* **Attachments Support**: Multer-driven backend validator checking file size (10MB max limit) and MIME formats (blocking executables). Images render inline; document types render download cards.
* **Disappearing Messages**: Configurable expiration duration per chat. Expired rows are filtered on fetch and lazily purged from database files.
* **Simulated Security Banner**: Professional notices stating E2E encryption is simulated in this assignment.

---

## Folder Structure

```
nexa-whispers/
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # RouteGuards
│   │   │   ├── layout/         # Sidebar, ChatArea
│   │   │   ├── chat/           # MessageBubble, MessageComposer
│   │   │   ├── modals/         # NewChatModal, SettingsModal
│   │   ├── pages/
│   │   │   ├── Landing/        # Landing landing page
│   │   │   ├── Login/          # Sign in panel
│   │   │   ├── Register/       # Sign up panel
│   │   │   ├── OTP/            # Verification panel
│   │   │   ├── Onboarding/     # Avatar suggest panel
│   │   │   ├── Chat/           # Layout orchestrator
│   │   ├── context/            # Auth, Sockets, Theme, Conversations context
│   │   ├── services/           # api (Axios Client wrapper)
│   │   ├── index.css           # Global tokens stylesheet
│   │   ├── App.jsx             # Router cascading wrappers
│   │   └── main.jsx            # Entry point
│   ├── .env.example
│   └── package.json
│
└── backend/
    ├── src/
    │   ├── config/             # DB & Env variables configuration
    │   ├── database/           # SQLite connection, schemas and seeds
    │   ├── middleware/         # Auth cookie verification, upload check, errorHandler
    │   ├── validators/         # Input checkers (Auth, Contact, Messages)
    │   ├── controllers/        # Express handlers (Auth, User, Contact, Conversation)
    │   ├── services/           # Database transactions and query mutations
    │   ├── sockets/            # Handshake verification, presence, messaging sync
    │   └── app.js              # Express app setup
    ├── uploads/                # Serve uploads directory
    ├── database/               # Local sqlite file storage
    ├── .env.example
    ├── server.js               # Entry point
    └── package.json
```

---

## Database Schema (SQLite)

We enforce standard relational constraints with cascaded deletions and custom indexes:

```sql
PRAGMA foreign_keys = ON;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_online INTEGER DEFAULT 0,
  last_seen INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  contact_user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, contact_user_id)
);

-- Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT CHECK(type IN ('direct', 'group')) NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_by INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Members Table
CREATE TABLE IF NOT EXISTS conversation_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT CHECK(role IN ('member', 'admin')) DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(conversation_id, user_id)
);

-- Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT CHECK(message_type IN ('text', 'attachment')) DEFAULT 'text',
  status TEXT CHECK(status IN ('sending', 'sent', 'delivered', 'read')) DEFAULT 'sent',
  reply_to_message_id INTEGER,
  expires_at INTEGER,
  client_msg_id TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL
);

-- Receipts Table
CREATE TABLE IF NOT EXISTS message_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  status TEXT CHECK(status IN ('sent', 'delivered', 'read')) DEFAULT 'sent',
  delivered_at INTEGER,
  read_at INTEGER,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_id)
);

-- Reactions Table
CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(message_id, user_id)
);

-- Attachments Table
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
```

---

## API Endpoints

All responses follow a consistent response structure:
* **Success**: `{ success: true, data: ... }`
* **Error**: `{ success: false, error: "description", details: [] }`

### Auth API
* `POST /api/auth/register` - Create unverified user credentials.
* `POST /api/auth/verify-otp` - Verify dev OTP code `123456`.
* `POST /api/auth/login` - Verify password and set HTTP-only cookie JWT `token`.
* `POST /api/auth/logout` - Clear JWT token cookie.
* `GET /api/auth/me` - Retrieve current session user payload.

### Users & Contacts API
* `PUT /api/users/profile` - Update display name and avatar URL settings.
* `GET /api/contacts` - List mutual contacts for current user.
* `POST /api/contacts` - Add another user by username to contacts.
* `DELETE /api/contacts/:id` - Delete contact relations.
* `GET /api/contacts/search?q=` - Search registered user directory.

### Conversations & Messages API
* `GET /api/conversations` - List conversations, latest messages, and unread count badges.
* `POST /api/conversations/direct` - Check if direct chat exists, else create new direct chat transactionally.
* `POST /api/conversations/group` - Create group conversation, assign admin creator, and bind initial members.
* `GET /api/conversations/:id/messages` - Load pagination messages (lazy cleaning expired disappear rows, marks unread receipts as read).
* `POST /api/conversations/:id/messages` - Post text message or multipart file attachment (multer format checked).
* `POST /api/messages/:id/reactions` - Add reaction emoji.
* `DELETE /api/messages/:id/reactions` - Clear user emoji reaction.

---

## Socket.IO Real-Time Events

### Client $\rightarrow$ Server
* `typing:start` - Emit typing alert dot trigger.
* `typing:stop` - Halt typing dot trigger.
* `message:delivered` - Acknowledge that client received new message, writing delivery receipts in database.
* `message:read` - Acknowledge that client focuses chat, marking messages as read in database.

### Server $\rightarrow$ Client
* `user:online` - Notify contacts user is online.
* `user:offline` - Notify contacts user is offline with relative last seen timestamp.
* `message:new` - Broadcast newly saved REST messages to conversation socket room.
* `message:status` - Sync receipt status tick changes.
* `message:read_sync` - Sync batch unread messages as read.
* `conversation:created` - Sync room joins and update inboxes for group invitations.
* `typing:start` / `typing:stop` - Sync typing states.

---

## Development Setup

### Prerequisite
Node.js (version 18 or above recommended).

### 1. Backend Server Configuration
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Run schema initialization:
   ```bash
   npm run db:init
   ```
5. Seed database with realistic demo accounts:
   ```bash
   npm run db:seed
   ```
6. Start development server on port 5000:
   ```bash
   npm run dev
   ```

### 2. Frontend SPA Configuration
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start Vite development server:
   ```bash
   npm run dev
   ```
4. Open the displayed URL (normally `http://localhost:5173`) in your browser.

---

## Demo Credentials

The database contains pre-configured profiles so the interface is populated immediately:

* **Users list**: `mihir`, `rahul`, `ananya`, `arjun`, `priya`, `neha`
* **Default password**: `password123`
* **OTP developer code**: `123456`

To simulate real-time conversations locally, open two different browser profiles (e.g. Chrome guest window and Incognito window):
1. Log in on window A as **mihir** / `password123`.
2. Log in on window B as **rahul** / `password123`.
3. Open the "Core Team" group chat or "Rahul" chat on window A and send messages, verifying status receipts and typing dots synchronization.

---

## SQLite Production Deployment Configuration

SQLite is a file-based local database. To prevent database erasure upon container rebuilds in production environments:
* **Backend deployment (Render)**: Attach a persistent disk to the Render web service, mounted to `/var/data`. Set `DATABASE_PATH=/var/data/database.db` in Render environment variables. This ensures the database file persists across service restarts and builds.
