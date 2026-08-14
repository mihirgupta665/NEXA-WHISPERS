import http from 'http';
import dotenv from 'dotenv';
import app from './src/app.js';
import { initSocketServer } from './src/sockets/socketServer.js';
import { initSchema } from './src/database/schema.js';
import storyService from './src/services/storyService.js';

dotenv.config();

// Initialize database schema and auto-seed stories on startup
await initSchema();
await storyService.checkAndSeedStories();

const server = http.createServer(app);

// Initialize real-time Socket.IO server wrapped around HTTP server
const io = initSocketServer(server);

// Share the Socket.IO server reference with Express app for REST controller broadcasts
app.set('io', io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`[Server] Nexa Whispers API and WebSocket server listening on port ${PORT}`);
});
