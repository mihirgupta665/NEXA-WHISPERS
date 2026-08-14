# Nexa Whispers

A polished, privacy-focused messaging platform inspired by modern secure chat apps.

Nexa Whispers combines a React frontend, an Express + Socket.IO backend, and a persistent SQLite database to deliver real-time messaging, contact management, group chats, and attachment support in a minimal, premium interface.

---

## Overview

This project is designed to feel like a modern messaging application while staying lightweight and easy to run locally or deploy in production.

### Core capabilities
- Secure user authentication with bcrypt and JWT cookies
- Real-time conversations via Socket.IO
- Direct and group chat support
- Message receipts and typing indicators
- Attachment support stored in SQLite for persistence
- Responsive, premium dark UI
- SQLite-backed data storage suitable for Render deployments

---

## Tech stack

### Frontend
- React + Vite
- React Router
- Axios for API access
- Socket.IO client for realtime communication
- Custom CSS-based design system

### Backend
- Node.js + Express
- Socket.IO server
- SQLite database with sqlite3 + sqlite
- JWT cookie auth
- multer for file upload handling

### Database
- SQLite persistence at `backend/database/database.db`
- Production-safe fallback path handling for Render

---

## Project structure

```text
NEXA-WHISPERS/
├── backend/
│   ├── database/
│   │   └── database.db
│   ├── src/
│   │   ├── controllers/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── sockets/
│   │   ├── validators/
│   │   ├── app.js
│   │   └── ...
│   ├── .env.example
│   ├── package.json
│   ├── postinstall.js
│   └── server.js
├── frontend/
│   ├── src/
│   ├── public/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
├── README.md
└── package.json
```

---

## Features

### Messaging
- Direct chats and group conversations
- Message replies and conversation context
- Reactions and typing indicators
- Delivery and read status tracking
- Real-time update propagation across clients

### User experience
- Minimal premium interface
- Dark mode styling
- Searchable conversations and contacts
- Responsive layout for desktop use

### Data persistence
- User data, conversations, messages, reactions, and attachments are stored in SQLite
- Attachment content is saved in the database instead of ephemeral filesystem storage
- This avoids data loss on Render rebuilds and restarts

---

## Local development setup

### Prerequisites
- Node.js 18+
- npm

### 1) Install backend dependencies

```bash
cd backend
npm install
```

### 2) Configure backend environment

Copy the example file and update values if needed:

```bash
cp .env.example .env
```

Example:

```env
PORT=5000
JWT_SECRET=nexa_whispers_development_secret_key_13579
CLIENT_URL=http://localhost:5173
DATABASE_PATH=database/database.db
NODE_ENV=development
```

### 3) Start the backend

```bash
npm run dev
```

The backend runs on:

```bash
http://localhost:5000
```

### 4) Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 5) Configure frontend environment

```bash
cp .env.example .env
```

Example:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### 6) Start the frontend

```bash
npm run dev
```

The frontend runs on:

```bash
http://localhost:5173
```

---

## Production deployment

### Backend on Render
Set the following environment variables in Render:

```env
PORT=10000
JWT_SECRET=your_secure_secret
CLIENT_URL=https://your-vercel-app.vercel.app
DATABASE_PATH=/opt/render/project/src/backend/database/database.db
NODE_ENV=production
```

Notes:
- Use a writable path, not `/database`
- SQLite data persists in the project folder on Render when the path is valid

### Frontend on Vercel
Set these variables in Vercel:

```env
VITE_API_URL=https://your-render-backend.onrender.com
VITE_SOCKET_URL=https://your-render-backend.onrender.com
```

Then deploy the `frontend` directory as a Vite app with:
- Build command: `npm run build`
- Output directory: `dist`

---

## API overview

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Users
- `GET /api/users/profile`
- `PUT /api/users/profile`

### Contacts
- `GET /api/contacts`
- `POST /api/contacts`
- `DELETE /api/contacts/:id`

### Conversations
- `GET /api/conversations`
- `POST /api/conversations/direct`
- `POST /api/conversations/group`
- `GET /api/conversations/:id/messages`
- `POST /api/conversations/:id/messages`

### Messages
- `POST /api/messages/:id/reactions`
- `DELETE /api/messages/:id/reactions`
- `GET /api/messages/search`

---

## Real-time events

### Client to server
- `typing:start`
- `typing:stop`
- `message:delivered`
- `message:read`

### Server to client
- `message:new`
- `message:status`
- `conversation:created`
- `user:online`
- `user:offline`

---

## Notes

This project uses SQLite as the database layer for simplicity, cross-platform compatibility, and persistence without requiring a managed database service. The app is intentionally designed to be easy to understand, extend, and deploy while preserving the core messaging experience.

---

## License

This project is intended for educational and portfolio use.



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

---

## Troubleshooting

### Port 5001 already in use (Hanging Node Process)
If the application fails to start or remains stuck on the loading screen ("Syncing channels..."), a dangling/hanging `node` process might be occupying port `5001`.

To fix this:
1. Identify the process ID (PID) using port 5001:
   * **PowerShell:**
     ```powershell
     Get-Process -Id (Get-NetTCPConnection -LocalPort 5001).OwningProcess
     ```
   * **CMD:**
     ```cmd
     netstat -ano | findstr :5001
     ```
2. Kill the hanging process:
   * **PowerShell:**
     ```powershell
     Stop-Process -Id <PID> -Force
     ```
   * **CMD:**
     ```cmd
     taskkill /PID <PID> /F
     ```
3. Restart the dev environment:
   ```bash
   npm run dev
   ```

